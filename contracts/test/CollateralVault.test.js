const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CollateralVault", function () {
  let vault, token, owner, user, loanContract, liquidator;
  const BONUS = 500n; // 5 %
  const THRESHOLD = 8000n; // 80 %

  beforeEach(async function () {
    [owner, user, loanContract, liquidator] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("Collateral Token", "COL", 18);

    const Vault = await ethers.getContractFactory("CollateralVault");
    vault = await Vault.deploy(BONUS);

    await vault.setLoanContract(loanContract.address);
    await vault.configureToken(await token.getAddress(), THRESHOLD);

    await token.mint(user.address, ethers.parseEther("10000"));
    await token.connect(user).approve(await vault.getAddress(), ethers.MaxUint256);
  });

  describe("Deposit / Withdraw", function () {
    it("deposits correctly", async function () {
      await expect(vault.connect(user).deposit(await token.getAddress(), ethers.parseEther("100")))
        .to.emit(vault, "Deposited")
        .withArgs(user.address, await token.getAddress(), ethers.parseEther("100"));

      const info = await vault.collateral(user.address, await token.getAddress());
      expect(info.deposited).to.equal(ethers.parseEther("100"));
      expect(info.locked).to.equal(0);
    });

    it("reverts deposit for unsupported token", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const bad = await MockERC20.deploy("Bad", "BAD", 18);
      await bad.mint(user.address, ethers.parseEther("100"));
      await bad.connect(user).approve(await vault.getAddress(), ethers.MaxUint256);

      await expect(vault.connect(user).deposit(await bad.getAddress(), ethers.parseEther("100")))
        .to.be.revertedWith("Vault: unsupported token");
    });

    it("reverts deposit of zero amount", async function () {
      await expect(vault.connect(user).deposit(await token.getAddress(), 0))
        .to.be.revertedWith("Vault: zero amount");
    });

    it("withdraws free collateral", async function () {
      await vault.connect(user).deposit(await token.getAddress(), ethers.parseEther("100"));

      await expect(vault.connect(user).withdraw(await token.getAddress(), ethers.parseEther("60")))
        .to.emit(vault, "Withdrawn")
        .withArgs(user.address, await token.getAddress(), ethers.parseEther("60"));

      const info = await vault.collateral(user.address, await token.getAddress());
      expect(info.deposited).to.equal(ethers.parseEther("40"));
    });

    it("cannot withdraw locked collateral", async function () {
      await vault.connect(user).deposit(await token.getAddress(), ethers.parseEther("100"));
      await vault.connect(loanContract).lock(user.address, await token.getAddress(), ethers.parseEther("80"));

      await expect(vault.connect(user).withdraw(await token.getAddress(), ethers.parseEther("30")))
        .to.be.revertedWith("Vault: exceeds free collateral");
    });
  });

  describe("Lock / Unlock (LoanContract only)", function () {
    beforeEach(async function () {
      await vault.connect(user).deposit(await token.getAddress(), ethers.parseEther("100"));
    });

    it("locks collateral", async function () {
      await expect(vault.connect(loanContract).lock(user.address, await token.getAddress(), ethers.parseEther("50")))
        .to.emit(vault, "Locked");

      const info = await vault.collateral(user.address, await token.getAddress());
      expect(info.locked).to.equal(ethers.parseEther("50"));
    });

    it("unlocks collateral", async function () {
      await vault.connect(loanContract).lock(user.address, await token.getAddress(), ethers.parseEther("50"));
      await vault.connect(loanContract).unlock(user.address, await token.getAddress(), ethers.parseEther("30"));

      const info = await vault.collateral(user.address, await token.getAddress());
      expect(info.locked).to.equal(ethers.parseEther("20"));
    });

    it("reverts lock from non-loan-contract", async function () {
      await expect(vault.connect(user).lock(user.address, await token.getAddress(), ethers.parseEther("50")))
        .to.be.revertedWith("Vault: caller != LoanContract");
    });

    it("reverts if locking more than free", async function () {
      await expect(vault.connect(loanContract).lock(user.address, await token.getAddress(), ethers.parseEther("200")))
        .to.be.revertedWith("Vault: insufficient free collateral");
    });
  });

  describe("Liquidation", function () {
    beforeEach(async function () {
      await vault.connect(user).deposit(await token.getAddress(), ethers.parseEther("100"));
      await vault.connect(loanContract).lock(user.address, await token.getAddress(), ethers.parseEther("100"));
    });

    it("transfers seized + bonus to liquidator", async function () {
      const seize = ethers.parseEther("80");
      const bonus = (seize * BONUS) / 10000n; // 4
      const total = seize + bonus; // 84

      await expect(vault.connect(loanContract).liquidate(
        user.address, liquidator.address, await token.getAddress(), seize
      )).to.emit(vault, "Liquidated");

      expect(await token.balanceOf(liquidator.address)).to.equal(total);
      const info = await vault.collateral(user.address, await token.getAddress());
      expect(info.deposited).to.equal(ethers.parseEther("100") - total);
    });

    it("caps seizure to locked amount", async function () {
      // Try to seize more than locked
      await vault.connect(loanContract).liquidate(
        user.address, liquidator.address, await token.getAddress(), ethers.parseEther("200")
      );
      expect(await token.balanceOf(liquidator.address)).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Admin", function () {
    it("owner can configure tokens", async function () {
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const t2 = await MockERC20.deploy("T2", "T2", 18);
      await expect(vault.configureToken(await t2.getAddress(), 7500))
        .to.emit(vault, "TokenConfigured");
      expect(await vault.supportedTokens(await t2.getAddress())).to.be.true;
    });

    it("owner can remove tokens", async function () {
      await vault.removeToken(await token.getAddress());
      expect(await vault.supportedTokens(await token.getAddress())).to.be.false;
    });

    it("owner can update liquidation bonus", async function () {
      await vault.setLiquidationBonus(1000);
      expect(await vault.liquidationBonusBps()).to.equal(1000n);
    });

    it("reverts bonus > 20 %", async function () {
      await expect(vault.setLiquidationBonus(2001)).to.be.revertedWith("bonus too high");
    });
  });
});
