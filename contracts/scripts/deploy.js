const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)));

  // ── 1. InterestRateModel ───────────────────────────────────────
  const InterestRateModel = await hre.ethers.getContractFactory("InterestRateModel");
  const rateModel = await InterestRateModel.deploy(
    200,   // baseRate: 2 %
    1000,  // slopeBeforeKink: 10 %
    5000,  // slopeAfterKink: 50 %
    8000,  // kinkUtilisation: 80 %
    3000   // maxTrustDiscount: 30 %
  );
  await rateModel.waitForDeployment();
  const rateModelAddr = await rateModel.getAddress();
  console.log("InterestRateModel:", rateModelAddr);

  // ── 2. CollateralVault ─────────────────────────────────────────
  const CollateralVault = await hre.ethers.getContractFactory("CollateralVault");
  const vault = await CollateralVault.deploy(500); // 5 % liquidation bonus
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("CollateralVault:  ", vaultAddr);

  // ── 3. SoulboundReputationNFT ──────────────────────────────────
  const SoulboundReputationNFT = await hre.ethers.getContractFactory("SoulboundReputationNFT");
  const nft = await SoulboundReputationNFT.deploy();
  await nft.waitForDeployment();
  const nftAddr = await nft.getAddress();
  console.log("SoulboundRepNFT:  ", nftAddr);

  // ── 4. LoanContract ────────────────────────────────────────────
  const LoanContract = await hre.ethers.getContractFactory("LoanContract");
  const loan = await LoanContract.deploy(
    vaultAddr,
    rateModelAddr,
    nftAddr,
    300,   // minTrustScore
    15000, // collateralRatioBps: 150 %
    3      // maxActiveLoansPerUser
  );
  await loan.waitForDeployment();
  const loanAddr = await loan.getAddress();
  console.log("LoanContract:     ", loanAddr);

  // ── 5. Wire vault → loan contract ─────────────────────────────
  await vault.setLoanContract(loanAddr);
  console.log("Vault authorised LoanContract");

  console.log("\n--- Deployment complete ---");
  console.log({
    InterestRateModel: rateModelAddr,
    CollateralVault: vaultAddr,
    SoulboundReputationNFT: nftAddr,
    LoanContract: loanAddr,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
