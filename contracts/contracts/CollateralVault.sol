// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  CollateralVault
 * @notice Holds ERC-20 collateral tokens on behalf of borrowers.
 *         Only the authorised LoanContract can lock / unlock / liquidate.
 *
 *         Supports per-token liquidation thresholds and a liquidation bonus
 *         paid to the liquidator from the borrower's collateral.
 */
contract CollateralVault is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ── State ────────────────────────────────────────────────────
    address public loanContract;

    struct CollateralInfo {
        uint256 deposited;
        uint256 locked;       // portion locked against active loans
    }

    // user → token → info
    mapping(address => mapping(address => CollateralInfo)) public collateral;

    // token → allowed as collateral
    mapping(address => bool) public supportedTokens;

    // Liquidation threshold in basis points (e.g. 8000 = 80 %)
    // If collateral value drops below (debt * threshold / 10000) → liquidatable
    mapping(address => uint256) public liquidationThresholdBps;

    uint256 public liquidationBonusBps; // e.g. 500 = 5 % bonus to liquidator

    uint256 public constant BPS = 10_000;

    // ── Events ───────────────────────────────────────────────────
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Locked(address indexed user, address indexed token, uint256 amount);
    event Unlocked(address indexed user, address indexed token, uint256 amount);
    event Liquidated(
        address indexed borrower,
        address indexed liquidator,
        address indexed token,
        uint256 seized,
        uint256 bonus
    );
    event TokenConfigured(address indexed token, uint256 thresholdBps);
    event LoanContractSet(address indexed loanContract);
    event LiquidationBonusSet(uint256 bonusBps);

    // ── Modifiers ────────────────────────────────────────────────
    modifier onlyLoanContract() {
        require(msg.sender == loanContract, "Vault: caller != LoanContract");
        _;
    }

    constructor(uint256 _liquidationBonusBps) Ownable(msg.sender) {
        require(_liquidationBonusBps <= 2000, "bonus too high");
        liquidationBonusBps = _liquidationBonusBps;
    }

    // ── User-facing ──────────────────────────────────────────────

    /**
     * @notice Deposit collateral into the vault.
     *         Tokens must be approved by the caller beforehand.
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        require(supportedTokens[token], "Vault: unsupported token");
        require(amount > 0, "Vault: zero amount");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        collateral[msg.sender][token].deposited += amount;

        emit Deposited(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw unlocked collateral.
     */
    function withdraw(address token, uint256 amount) external nonReentrant {
        CollateralInfo storage info = collateral[msg.sender][token];
        uint256 free = info.deposited - info.locked;
        require(amount <= free, "Vault: exceeds free collateral");

        info.deposited -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, token, amount);
    }

    /**
     * @notice Returns the free (unlocked) collateral for a user/token pair.
     */
    function freeCollateral(address user, address token) external view returns (uint256) {
        CollateralInfo storage info = collateral[user][token];
        return info.deposited - info.locked;
    }

    // ── LoanContract-only ────────────────────────────────────────

    /**
     * @notice Lock a portion of the borrower's deposited collateral.
     */
    function lock(address user, address token, uint256 amount) external onlyLoanContract {
        CollateralInfo storage info = collateral[user][token];
        require(info.deposited - info.locked >= amount, "Vault: insufficient free collateral");
        info.locked += amount;
        emit Locked(user, token, amount);
    }

    /**
     * @notice Unlock previously locked collateral (e.g. after full repayment).
     */
    function unlock(address user, address token, uint256 amount) external onlyLoanContract {
        CollateralInfo storage info = collateral[user][token];
        require(info.locked >= amount, "Vault: unlock > locked");
        info.locked -= amount;
        emit Unlocked(user, token, amount);
    }

    /**
     * @notice Seize collateral during liquidation.
     *         Transfers (seized + bonus) to liquidator, reducing borrower balance.
     * @param  borrower   The defaulting borrower.
     * @param  liquidator Who triggers the liquidation (receives seized funds).
     * @param  token      Collateral token.
     * @param  seizeAmount Base amount of collateral to seize (covers debt value).
     */
    function liquidate(
        address borrower,
        address liquidator,
        address token,
        uint256 seizeAmount
    ) external onlyLoanContract nonReentrant {
        CollateralInfo storage info = collateral[borrower][token];

        uint256 bonus = (seizeAmount * liquidationBonusBps) / BPS;
        uint256 totalSeized = seizeAmount + bonus;

        // Cap to whatever the borrower actually has locked
        if (totalSeized > info.locked) totalSeized = info.locked;
        if (totalSeized > info.deposited) totalSeized = info.deposited;

        info.locked -= totalSeized;
        info.deposited -= totalSeized;

        IERC20(token).safeTransfer(liquidator, totalSeized);

        emit Liquidated(borrower, liquidator, token, seizeAmount, bonus);
    }

    // ── Admin ────────────────────────────────────────────────────

    function setLoanContract(address _loanContract) external onlyOwner {
        require(_loanContract != address(0), "Vault: zero address");
        loanContract = _loanContract;
        emit LoanContractSet(_loanContract);
    }

    function configureToken(address token, uint256 thresholdBps) external onlyOwner {
        require(thresholdBps > 0 && thresholdBps <= BPS, "Vault: bad threshold");
        supportedTokens[token] = true;
        liquidationThresholdBps[token] = thresholdBps;
        emit TokenConfigured(token, thresholdBps);
    }

    function removeToken(address token) external onlyOwner {
        supportedTokens[token] = false;
        liquidationThresholdBps[token] = 0;
    }

    function setLiquidationBonus(uint256 _bonusBps) external onlyOwner {
        require(_bonusBps <= 2000, "bonus too high");
        liquidationBonusBps = _bonusBps;
        emit LiquidationBonusSet(_bonusBps);
    }
}
