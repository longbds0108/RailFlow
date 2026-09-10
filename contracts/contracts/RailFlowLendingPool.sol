// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RailFlowLendingPool
/// @notice Multi-asset money market for Arc Testnet: supply USDC, EURC or
/// cirBTC as collateral and borrow any listed asset against your combined
/// collateral value, the same cross-asset model as the Lend page's
/// illustrative preview — now backed by a real contract.
/// @dev Testnet demo: interest-free, and each asset is priced via an
/// owner-set rate rather than a live oracle (see setPrice). Liquidity is
/// simply the pool's own token balance — supplying adds to it, borrowing
/// draws from it, there is no separate funding step.
contract RailFlowLendingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct AssetConfig {
        uint8 decimals;
        uint256 priceInUsdc; // price of 1 whole token, in USDC's smallest units
        uint256 collateralFactorBps;
        bool borrowable;
        bool listed;
    }

    struct UserAsset {
        uint256 supplied;
        uint256 borrowed;
    }

    /// @notice A user-granted, contract-enforced permission letting one
    /// `agent` address repay this user's `repayToken` debt on their behalf,
    /// but only while all of these hold: utilization is above `thresholdBps`,
    /// the mandate hasn't expired, today's cumulative pull is under
    /// `dailyLimit`, and the user's own wallet balance stays at or above
    /// `reserveAmount` afterwards. The agent (an off-chain rule engine)
    /// decides *when* to act and *how much*; this struct is what the
    /// contract checks before letting that call through.
    struct Mandate {
        address agent;
        address repayToken;
        uint256 thresholdBps;
        uint256 dailyLimit;
        uint256 reserveAmount;
        uint256 expiresAt;
        uint256 spentToday;
        uint256 windowStart;
        bool active;
    }

    uint256 public constant BPS_DENOMINATOR = 10_000;

    address[] public assetList;
    mapping(address => AssetConfig) public assets;
    mapping(address => mapping(address => UserAsset)) public userAssets; // user => token => position
    mapping(address => Mandate) public repayMandates; // user => their debt-guardrail mandate

    event AssetListed(address indexed token, uint8 decimals, uint256 price, uint256 collateralFactorBps, bool borrowable);
    event PriceUpdated(address indexed token, uint256 price);
    event CollateralFactorUpdated(address indexed token, uint256 collateralFactorBps);
    event BorrowableUpdated(address indexed token, bool borrowable);
    event Supplied(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Borrowed(address indexed user, address indexed token, uint256 amount);
    event Repaid(address indexed user, address indexed token, uint256 amount);
    event MandateSet(
        address indexed user,
        address indexed agent,
        address repayToken,
        uint256 thresholdBps,
        uint256 dailyLimit,
        uint256 reserveAmount,
        uint256 expiresAt
    );
    event MandateRevoked(address indexed user);
    event AgentRepaid(
        address indexed user,
        address indexed agent,
        address token,
        uint256 amount,
        uint256 utilizationBpsBefore,
        uint256 utilizationBpsAfter,
        uint256 remainingBorrowed
    );

    constructor(address _owner) Ownable(_owner) {}

    // ---------- Owner: asset listing ----------

    function listAsset(address token, uint8 decimals, uint256 initialPrice, uint256 collateralFactorBps, bool borrowable)
        external
        onlyOwner
    {
        require(token != address(0), "zero token");
        require(collateralFactorBps <= BPS_DENOMINATOR, "factor>100%");
        require(initialPrice > 0, "price=0");
        if (!assets[token].listed) {
            assetList.push(token);
        }
        assets[token] = AssetConfig({
            decimals: decimals,
            priceInUsdc: initialPrice,
            collateralFactorBps: collateralFactorBps,
            borrowable: borrowable,
            listed: true
        });
        emit AssetListed(token, decimals, initialPrice, collateralFactorBps, borrowable);
    }

    function setPrice(address token, uint256 price) external onlyOwner {
        require(assets[token].listed, "not listed");
        require(price > 0, "price=0");
        assets[token].priceInUsdc = price;
        emit PriceUpdated(token, price);
    }

    function setCollateralFactor(address token, uint256 collateralFactorBps) external onlyOwner {
        require(assets[token].listed, "not listed");
        require(collateralFactorBps <= BPS_DENOMINATOR, "factor>100%");
        assets[token].collateralFactorBps = collateralFactorBps;
        emit CollateralFactorUpdated(token, collateralFactorBps);
    }

    function setBorrowable(address token, bool borrowable) external onlyOwner {
        require(assets[token].listed, "not listed");
        assets[token].borrowable = borrowable;
        emit BorrowableUpdated(token, borrowable);
    }

    // ---------- User actions ----------

    function supply(address token, uint256 amount) external nonReentrant {
        require(assets[token].listed, "not listed");
        require(amount > 0, "amount=0");
        userAssets[msg.sender][token].supplied += amount;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Supplied(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external nonReentrant {
        require(assets[token].listed, "not listed");
        UserAsset storage pos = userAssets[msg.sender][token];
        require(amount > 0 && amount <= pos.supplied, "invalid amount");
        require(IERC20(token).balanceOf(address(this)) >= amount, "insufficient liquidity");
        pos.supplied -= amount;
        require(_isHealthy(msg.sender), "would breach collateral factor");
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    function borrow(address token, uint256 amount) external nonReentrant {
        AssetConfig memory cfg = assets[token];
        require(cfg.listed && cfg.borrowable, "not borrowable");
        require(amount > 0, "amount=0");
        require(IERC20(token).balanceOf(address(this)) >= amount, "insufficient liquidity");
        userAssets[msg.sender][token].borrowed += amount;
        require(_isHealthy(msg.sender), "exceeds collateral limit");
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, token, amount);
    }

    function repay(address token, uint256 amount) external nonReentrant {
        UserAsset storage pos = userAssets[msg.sender][token];
        require(amount > 0 && amount <= pos.borrowed, "invalid amount");
        pos.borrowed -= amount;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Repaid(msg.sender, token, amount);
    }

    // ---------- Debt guardrail mandate ----------

    /// @notice Grant `agent` permission to call `agentRepay` on your behalf.
    /// Overwrites any existing mandate. Requires a prior ERC-20 `approve` of
    /// this pool for `repayToken` (the agent pulls via transferFrom, same as
    /// a normal `repay`) — the mandate only governs *when* and *how much*
    /// the agent may draw, not the underlying token allowance.
    function setRepayMandate(
        address agent,
        address repayToken,
        uint256 thresholdBps,
        uint256 dailyLimit,
        uint256 reserveAmount,
        uint256 expiresAt
    ) external {
        require(agent != address(0), "zero agent");
        require(assets[repayToken].listed, "token not listed");
        require(thresholdBps > 0 && thresholdBps <= BPS_DENOMINATOR, "bad threshold");
        require(expiresAt > block.timestamp, "expiry in past");
        repayMandates[msg.sender] = Mandate({
            agent: agent,
            repayToken: repayToken,
            thresholdBps: thresholdBps,
            dailyLimit: dailyLimit,
            reserveAmount: reserveAmount,
            expiresAt: expiresAt,
            spentToday: 0,
            windowStart: block.timestamp,
            active: true
        });
        emit MandateSet(msg.sender, agent, repayToken, thresholdBps, dailyLimit, reserveAmount, expiresAt);
    }

    function revokeMandate() external {
        require(repayMandates[msg.sender].active, "no active mandate");
        repayMandates[msg.sender].active = false;
        emit MandateRevoked(msg.sender);
    }

    /// @notice Called by a user's mandated agent to repay `amount` of their
    /// debt on their behalf. The off-chain rule engine decides *when* to
    /// call this and *how much* to pass; this function only enforces that
    /// the call respects the mandate the user themselves granted.
    function agentRepay(address user, uint256 amount) external nonReentrant {
        Mandate storage m = repayMandates[user];
        require(m.active, "no active mandate");
        require(m.agent == msg.sender, "not the mandated agent");
        require(block.timestamp <= m.expiresAt, "mandate expired");
        require(amount > 0, "amount=0");

        (uint256 collateralValue, uint256 borrowValueBefore) = accountData(user);
        require(collateralValue > 0, "no collateral");
        uint256 utilBefore = (borrowValueBefore * BPS_DENOMINATOR) / collateralValue;
        require(utilBefore > m.thresholdBps, "utilization below threshold");

        if (block.timestamp >= m.windowStart + 1 days) {
            m.windowStart = block.timestamp;
            m.spentToday = 0;
        }
        require(m.spentToday + amount <= m.dailyLimit, "exceeds daily limit");

        address token = m.repayToken;
        UserAsset storage pos = userAssets[user][token];
        require(amount <= pos.borrowed, "exceeds debt");

        uint256 walletBalance = IERC20(token).balanceOf(user);
        require(walletBalance >= amount + m.reserveAmount, "would breach reserve");

        m.spentToday += amount;
        pos.borrowed -= amount;
        IERC20(token).safeTransferFrom(user, address(this), amount);

        (uint256 collateralValueAfter, uint256 borrowValueAfter) = accountData(user);
        uint256 utilAfter = collateralValueAfter > 0 ? (borrowValueAfter * BPS_DENOMINATOR) / collateralValueAfter : 0;

        emit AgentRepaid(user, msg.sender, token, amount, utilBefore, utilAfter, pos.borrowed);
    }

    /// @notice One-call snapshot of a user's mandate plus their live
    /// utilization, so the rule engine (and the frontend) don't need to
    /// stitch together `repayMandates` + `accountData` themselves.
    function mandateStatus(address user)
        external
        view
        returns (
            address agent,
            address repayToken,
            uint256 thresholdBps,
            uint256 dailyLimit,
            uint256 spentToday,
            uint256 reserveAmount,
            uint256 expiresAt,
            bool active,
            uint256 currentUtilizationBps
        )
    {
        Mandate memory m = repayMandates[user];
        uint256 spent = block.timestamp >= m.windowStart + 1 days ? 0 : m.spentToday;
        (uint256 collateralValue, uint256 borrowValue) = accountData(user);
        return (
            m.agent,
            m.repayToken,
            m.thresholdBps,
            m.dailyLimit,
            spent,
            m.reserveAmount,
            m.expiresAt,
            m.active,
            collateralValue > 0 ? (borrowValue * BPS_DENOMINATOR) / collateralValue : 0
        );
    }

    // ---------- Views ----------

    function assetCount() external view returns (uint256) {
        return assetList.length;
    }

    /// @notice Collateral-factor-weighted collateral value and total borrowed
    /// value for `user`, both expressed in USDC's smallest units.
    function accountData(address user) public view returns (uint256 collateralValue, uint256 borrowValue) {
        uint256 len = assetList.length;
        for (uint256 i = 0; i < len; i++) {
            address token = assetList[i];
            AssetConfig memory cfg = assets[token];
            UserAsset memory pos = userAssets[user][token];
            if (pos.supplied > 0) {
                uint256 value = (pos.supplied * cfg.priceInUsdc) / (10 ** cfg.decimals);
                collateralValue += (value * cfg.collateralFactorBps) / BPS_DENOMINATOR;
            }
            if (pos.borrowed > 0) {
                borrowValue += (pos.borrowed * cfg.priceInUsdc) / (10 ** cfg.decimals);
            }
        }
    }

    function availableToBorrowUsdc(address user) external view returns (uint256) {
        (uint256 collateralValue, uint256 borrowValue) = accountData(user);
        return collateralValue > borrowValue ? collateralValue - borrowValue : 0;
    }

    function _isHealthy(address user) private view returns (bool) {
        (uint256 collateralValue, uint256 borrowValue) = accountData(user);
        return borrowValue <= collateralValue;
    }
}
