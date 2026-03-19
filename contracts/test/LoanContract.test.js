const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("LoanContract", function () {
  let loanC, vault, rateModel, nft;
  let borrowToken, collateralToken;
  let owner, borrower, lender, liquidator;

  const BPS = 10000n;
  const ONE = ethers.parseEther("1");
  const PRICE = ethers.parseEther("1"); // 1 token = $1 (1e18)
  const DAY = 86400;

  async function deployFixture() {
    [owner, borrower, lender, liquidator] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    borrowToken = await MockERC20.deploy("USDC", "USDC", 18);
    collateralToken = await MockERC20.deploy("WETH", "WETH", 18);

    // Deploy InterestRateModel
    const RateModel = await ethers.getContractFactory("InterestRateModel");
    rateModel = await RateModel.deploy(200, 1000, 5000, 8000, 3000);

    // Deploy CollateralVault
    const Vault = await ethers.getContractFactory("CollateralVault");
    vault = await Vault.deploy(500);

    // Deploy SoulboundReputationNFT
    const NFT = await ethers.getContractFactory("SoulboundReputationNFT");
    nft = await NFT.deploy();

    // Deploy LoanContract
    const Loan = await ethers.getContractFactory("LoanContract");
    loanC = await Loan.deploy(
      await vault.getAddress(),
      await rateModel.getAddress(),
      await nft.getAddress(),
      300,   // minTrustScore
      15000, // 150 % collateral ratio
      3      // max active loans
    );

    // Wire up
    await vault.setLoanContract(await loanC.getAddress());
    await vault.configureToken(await collateralToken.getAddress(), 8000); // 80 % liquidation threshold

    // Set prices
    await loanC.setPrice(await borrowToken.getAddress(), PRICE);
    await loanC.setPrice(await collateralToken.getAddress(), PRICE);

    // Set pool supply for rate calculation
    await loanC.setPoolSupply(ethers.parseEther("100000"));

    // Mint reputation for borrower (score 700)
    await nft.mintReputation(borrower.address, 700, "GOOD");

    // Fund accounts
    await borrowToken.mint(lender.address, ethers.parseEther("100000"));
    await collateralToken.mint(borrower.address, ethers.parseEther("10000"));

    // Approvals
    await borrowToken.connect(lender).approve(await loanC.getAddress(), ethers.MaxUint256);
    await collateralToken.connect(borrower).approve(await vault.getAddress(), ethers.MaxUint256);

    // Borrower deposits collateral
    await vault.connect(borrower).deposit(
      await collateralToken.getAddress(),
      ethers.parseEther("5000")
    );
  }

  beforeEach(async function () {
    await deployFixture();
  });

  describe("Create Loan", function () {
    it("creates a loan request successfully", async function () {
      const tx = await loanC.connect(borrower).createLoan(
        await borrowToken.getAddress(),
        await collateralToken.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1500"),
        30 * DAY
      );

      await expect(tx).to.emit(loanC, "LoanCreated").withArgs(1, borrower.address, ethers.parseEther("1000"));

      const loan = await loanC.getLoan(1);
      expect(loan.borrower).to.equal(borrower.address);
      expect(loan.principal).to.equal(ethers.parseEther("1000"));
      expect(loan.collateralAmount).to.equal(ethers.parseEther("1500"));
      expect(loan.status).to.equal(0); // OPEN
    });

    it("reverts if trust score too low", async function () {
      // Mint a low-score reputation for lender as a new borrower
      await nft.mintReputation(lender.address, 100, "VERY_POOR");
      await collateralToken.mint(lender.address, ethers.parseEther("5000"));
      await collateralToken.connect(lender).approve(await vault.getAddress(), ethers.MaxUint256);
      await vault.connect(lender).deposit(await collateralToken.getAddress(), ethers.parseEther("5000"));

      await expect(
        loanC.connect(lender).createLoan(
          await borrowToken.getAddress(),
          await collateralToken.getAddress(),
          ethers.parseEther("100"),
          ethers.parseEther("200"),
          30 * DAY
        )
      ).to.be.revertedWith("Loan: trust score too low");
    });

    it("reverts if collateral insufficient", async function () {
      // 1000 borrowed requires 1500 collateral (150 %). We supply only 1000.
      await expect(
        loanC.connect(borrower).createLoan(
          await borrowToken.getAddress(),
          await collateralToken.getAddress(),
          ethers.parseEther("1000"),
          ethers.parseEther("1000"),
          30 * DAY
        )
      ).to.be.revertedWith("Loan: insufficient collateral value");
    });

    it("reverts for zero principal", async function () {
      await expect(
        loanC.connect(borrower).createLoan(
          await borrowToken.getAddress(),
          await collateralToken.getAddress(),
          0,
          ethers.parseEther("1500"),
          30 * DAY
        )
      ).to.be.revertedWith("Loan: zero principal");
    });

    it("reverts for too short duration", async function () {
      await expect(
        loanC.connect(borrower).createLoan(
          await borrowToken.getAddress(),
          await collateralToken.getAddress(),
          ethers.parseEther("100"),
          ethers.parseEther("200"),
          3600 // 1 hour (< 1 day)
        )
      ).to.be.revertedWith("Loan: duration too short");
    });

    it("enforces max active loans", async function () {
      for (let i = 0; i < 3; i++) {
        await loanC.connect(borrower).createLoan(
          await borrowToken.getAddress(),
          await collateralToken.getAddress(),
          ethers.parseEther("100"),
          ethers.parseEther("150"),
          30 * DAY
        );
      }

      await expect(
        loanC.connect(borrower).createLoan(
          await borrowToken.getAddress(),
          await collateralToken.getAddress(),
          ethers.parseEther("100"),
          ethers.parseEther("150"),
          30 * DAY
        )
      ).to.be.revertedWith("Loan: too many active loans");
    });
  });

  describe("Cancel Loan", function () {
    beforeEach(async function () {
      await loanC.connect(borrower).createLoan(
        await borrowToken.getAddress(),
        await collateralToken.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1500"),
        30 * DAY
      );
    });

    it("cancels and unlocks collateral", async function () {
      await expect(loanC.connect(borrower).cancelLoan(1))
        .to.emit(loanC, "LoanCancelled").withArgs(1);

      const loan = await loanC.getLoan(1);
      expect(loan.status).to.equal(4); // CANCELLED

      const free = await vault.freeCollateral(borrower.address, await collateralToken.getAddress());
      expect(free).to.equal(ethers.parseEther("5000")); // all collateral free again
    });

    it("reverts if not borrower", async function () {
      await expect(loanC.connect(lender).cancelLoan(1))
        .to.be.revertedWith("Loan: not borrower");
    });
  });

  describe("Fund Loan", function () {
    beforeEach(async function () {
      await loanC.connect(borrower).createLoan(
        await borrowToken.getAddress(),
        await collateralToken.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1500"),
        30 * DAY
      );
    });

    it("funds a loan, transfers principal to borrower", async function () {
      const borrowerBalBefore = await borrowToken.balanceOf(borrower.address);

      await expect(loanC.connect(lender).fundLoan(1))
        .to.emit(loanC, "LoanFunded");

      const loan = await loanC.getLoan(1);
      expect(loan.lender).to.equal(lender.address);
      expect(loan.status).to.equal(1); // FUNDED
      expect(loan.interestRateBps).to.be.gt(0);

      const borrowerBalAfter = await borrowToken.balanceOf(borrower.address);
      expect(borrowerBalAfter - borrowerBalBefore).to.equal(ethers.parseEther("1000"));
    });

    it("reverts self-funding", async function () {
      await borrowToken.mint(borrower.address, ethers.parseEther("10000"));
      await borrowToken.connect(borrower).approve(await loanC.getAddress(), ethers.MaxUint256);

      await expect(loanC.connect(borrower).fundLoan(1))
        .to.be.revertedWith("Loan: self-fund");
    });
  });

  describe("Repay", function () {
    beforeEach(async function () {
      await loanC.connect(borrower).createLoan(
        await borrowToken.getAddress(),
        await collateralToken.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1500"),
        30 * DAY
      );
      await loanC.connect(lender).fundLoan(1);

      // Give borrower tokens to repay (principal came from lender)
      await borrowToken.mint(borrower.address, ethers.parseEther("2000"));
      await borrowToken.connect(borrower).approve(await loanC.getAddress(), ethers.MaxUint256);
    });

    it("partial repay reduces outstanding debt", async function () {
      await time.increase(15 * DAY);

      await expect(loanC.connect(borrower).repay(1, ethers.parseEther("500")))
        .to.emit(loanC, "LoanRepaid");

      const loan = await loanC.getLoan(1);
      expect(loan.status).to.equal(1); // still FUNDED
      expect(loan.repaidAmount).to.equal(ethers.parseEther("500"));
    });

    it("full repay marks loan REPAID and unlocks collateral", async function () {
      await time.increase(1 * DAY);

      // Overpay to ensure full coverage (caps automatically)
      await expect(loanC.connect(borrower).repay(1, ethers.parseEther("2000")))
        .to.emit(loanC, "LoanFullyRepaid").withArgs(1);

      const loan = await loanC.getLoan(1);
      expect(loan.status).to.equal(2); // REPAID

      const free = await vault.freeCollateral(borrower.address, await collateralToken.getAddress());
      expect(free).to.equal(ethers.parseEther("5000")); // all free
    });

    it("reverts repay on non-funded loan", async function () {
      // Create and cancel another loan
      await loanC.connect(borrower).createLoan(
        await borrowToken.getAddress(),
        await collateralToken.getAddress(),
        ethers.parseEther("100"),
        ethers.parseEther("150"),
        30 * DAY
      );
      await loanC.connect(borrower).cancelLoan(2);

      await expect(loanC.connect(borrower).repay(2, ethers.parseEther("50")))
        .to.be.revertedWith("Loan: not funded");
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      await loanC.connect(borrower).createLoan(
        await borrowToken.getAddress(),
        await collateralToken.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1500"),
        30 * DAY
      );
      await loanC.connect(lender).fundLoan(1);
    });

    it("liquidates overdue loan", async function () {
      // Advance past deadline
      await time.increase(31 * DAY);

      await expect(loanC.connect(liquidator).liquidate(1))
        .to.emit(loanC, "LoanLiquidated")
        .withArgs(1, liquidator.address);

      const loan = await loanC.getLoan(1);
      expect(loan.status).to.equal(3); // LIQUIDATED

      // Liquidator received collateral tokens
      expect(await collateralToken.balanceOf(liquidator.address)).to.be.gt(0);
    });

    it("liquidates under-collateralised loan", async function () {
      // Drop collateral price to make it under-collateralised
      // At 150% collateral ratio with 1000 debt and 1500 collateral, both at $1
      // Liquidation threshold is 80%. If collateral value < 80% of debt value → liquidatable
      // Set collateral price to $0.50 → value = 750, debt ~ 1000+interest, 750 < 800 → liquidatable
      await loanC.setPrice(await collateralToken.getAddress(), ethers.parseEther("0.5"));

      await expect(loanC.connect(liquidator).liquidate(1))
        .to.emit(loanC, "LoanLiquidated");
    });

    it("reverts if not liquidatable", async function () {
      // Loan is healthy and not overdue
      await expect(loanC.connect(liquidator).liquidate(1))
        .to.be.revertedWith("Loan: not liquidatable");
    });
  });

  describe("View functions", function () {
    beforeEach(async function () {
      await loanC.connect(borrower).createLoan(
        await borrowToken.getAddress(),
        await collateralToken.getAddress(),
        ethers.parseEther("1000"),
        ethers.parseEther("1500"),
        30 * DAY
      );
      await loanC.connect(lender).fundLoan(1);
    });

    it("outstandingDebt accrues over time", async function () {
      const debt0 = await loanC.outstandingDebt(1);
      await time.increase(30 * DAY);
      const debt30 = await loanC.outstandingDebt(1);

      expect(debt30).to.be.gt(debt0);
      expect(debt30).to.be.gt(ethers.parseEther("1000"));
    });

    it("isLiquidatable returns false for healthy loan", async function () {
      expect(await loanC.isLiquidatable(1)).to.be.false;
    });

    it("isLiquidatable returns true for overdue loan", async function () {
      await time.increase(31 * DAY);
      expect(await loanC.isLiquidatable(1)).to.be.true;
    });
  });

  describe("Admin", function () {
    it("owner sets min trust score", async function () {
      await loanC.setMinTrustScore(500);
      expect(await loanC.minTrustScore()).to.equal(500n);
    });

    it("owner sets collateral ratio", async function () {
      await loanC.setCollateralRatio(20000);
      expect(await loanC.collateralRatioBps()).to.equal(20000n);
    });

    it("reverts collateral ratio below 100 %", async function () {
      await expect(loanC.setCollateralRatio(9999)).to.be.revertedWith("ratio < 100%");
    });

    it("non-owner cannot set prices", async function () {
      await expect(loanC.connect(borrower).setPrice(await borrowToken.getAddress(), PRICE))
        .to.be.revertedWithCustomError(loanC, "OwnableUnauthorizedAccount");
    });
  });
});
