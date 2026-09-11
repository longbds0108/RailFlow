// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RailFlowLendingPool
/// @notice Multi-asset money market for Arc Testnet: supply USDC, EURC or
/// cirBTC as collateral, borrow any listed asset against your combined
/// collateral value, at a real variable rate that moves with each asset's
/// utilization — Aave's classic kinked-rate model, scoped down to what a
/// testnet demo needs.
/// @dev Balances are stored "scaled" (principal / index at time of action)
/// and multiplied by the asset's current index on read — the standard way
/// to let interest compound for every holder without iterating over them.
/// Indices are 1e18-scaled ("WAD"). Prices are still owner-set (see
/// setPrice) rather than a live oracle; a position becomes liquidatable
/// when interest accrual (or an owner price change) pushes its borrowed
/// value past its liquidation threshold — not just from a user's own
/// supply/borrow/withdraw action, which is checked against the tighter
/// collateral factor up front.
contract RailFlowLendingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct AssetConfig {
        uint8 decimals;
        uint256 priceInUsdc; // price of 1 whole token, in USDC's smallest units
        uint256 collateralFactorBps; // max borrowing power per dollar of this collateral
        uint256 liquidationThresholdBps; // borrowing past this (not just the factor) makes a position liquidatable
        uint256 liquidationBonusBps; // extra collateral (bps) a liquidator receives over the debt they repay
        bool borrowable;
        bool listed;
    }

    struct InterestRateConfig {
        uint256 baseRateBps; // annual rate at 0% utilization
        uint256 optimalUtilizationBps; // utilization where the rate curve kinks upward
        uint256 slope1Bps; // annual rate added, linearly, up to the kink
        uint256 slope2Bps; // annual rate added, linearly, from the kink to 100% utilization
        uint256 reserveFactorBps; // share of borrower interest kept by the protocol, not paid to suppliers
    }

    struct ReserveState {
        uint256 liquidityIndex; // WAD, grows as suppliers earn interest
        uint256 borrowIndex; // WAD, grows as borrowers accrue interest
        uint256 totalScaledBorrow;
        uint256 lastUpdateTimestamp;
    }

    struct UserAsset {
        uint256 scaledSupplied;
        uint256 scaledBorrowed;
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
    uint256 public constant WAD = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    address[] public assetList;
    mapping(address => AssetConfig) public assets;
    mapping(address => InterestRateConfig) public rateConfigs;
    mapping(address => ReserveState) public reserves;
    mapping(address => mapping(address => UserAsset)) public userAssets; // user => token => position
    mapping(address => Mandate) public repayMandates; // user => their debt-guardrail mandate

    event AssetListed(address indexed token, uint8 decimals, uint256 price, uint256 collateralFactorBps, bool borrowable);
    event PriceUpdated(address indexed token, uint256 price);
    event CollateralFactorUpdated(address indexed token, uint256 collateralFactorBps);
    event BorrowableUpdated(address indexed token, bool borrowable);
    event InterestRateConfigured(address indexed token, uint256 baseRateBps, uint256 optimalUtilizationBps, uint256 slope1Bps, uint256 slope2Bps, uint256 reserveFactorBps);
    event Supplied(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event Borrowed(address indexed user, address indexed token, uint256 amount);
    event Repaid(address indexed user, address indexed token, uint256 amount);
    event Liquidated(
        address indexed user,
        address indexed liquidator,
        address debtToken,
        address collateralToken,
        uint256 repaidAmount,
        uint256 collateralSeized
    );
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

    // ---------- Owner: asset listing & risk config ----------

    function listAsset(
        address token,
        uint8 decimals,
        uint256 initialPrice,
        uint256 collateralFactorBps,
        uint256 liquidationThresholdBps,
        uint256 liquidationBonusBps,
        bool borrowable
    ) external onlyOwner {
        require(token != address(0), "zero token");
        require(collateralFactorBps <= BPS_DENOMINATOR, "factor>100%");
        require(liquidationThresholdBps >= collateralFactorBps && liquidationThresholdBps <= BPS_DENOMINATOR, "bad threshold");
        require(initialPrice > 0, "price=0");
        if (!assets[token].listed) {
            assetList.push(token);
            reserves[token] = ReserveState({
                liquidityIndex: WAD,
                borrowIndex: WAD,
                totalScaledBorrow: 0,
                lastUpdateTimestamp: block.timestamp
            });
        }
        assets[token] = AssetConfig({
            decimals: decimals,
            priceInUsdc: initialPrice,
            collateralFactorBps: collateralFactorBps,
            liquidationThresholdBps: liquidationThresholdBps,
            liquidationBonusBps: liquidationBonusBps,
            borrowable: borrowable,
            listed: true
        });
        emit AssetListed(token, decimals, initialPrice, collateralFactorBps, borrowable);
    }

    function setInterestRateConfig(
        address token,
        uint256 baseRateBps,
        uint256 optimalUtilizationBps,
        uint256 slope1Bps,
        uint256 slope2Bps,
        uint256 reserveFactorBps
    ) external onlyOwner {
        require(assets[token].listed, "not listed");
        require(optimalUtilizationBps > 0 && optimalUtilizationBps < BPS_DENOMINATOR, "bad optimal");
        require(reserveFactorBps <= BPS_DENOMINATOR, "factor>100%");
        _accrue(token);
        rateConfigs[token] = InterestRateConfig({
            baseRateBps: baseRateBps,
            optimalUtilizationBps: optimalUtilizationBps,
            slope1Bps: slope1Bps,
            slope2Bps: slope2Bps,
            reserveFactorBps: reserveFactorBps
        });
        emit InterestRateConfigured(token, baseRateBps, optimalUtilizationBps, slope1Bps, slope2Bps, reserveFactorBps);
    }

    function setPrice(address token, uint256 price) external onlyOwner {
        require(assets[token].listed, "not listed");
        require(price > 0, "price=0");
        assets[token].priceInUsdc = price;
        emit PriceUpdated(token, price);
    }

    function setCollateralFactor(address token, uint256 collateralFactorBps) external onlyOwner {
        require(assets[token].listed, "not listed");
        require(collateralFactorBps <= assets[token].liquidationThresholdBps, "factor>threshold");
        assets[token].collateralFactorBps = collateralFactorBps;
        emit CollateralFactorUpdated(token, collateralFactorBps);
    }

    function setBorrowable(address token, bool borrowable) external onlyOwner {
        require(assets[token].listed, "not listed");
        assets[token].borrowable = borrowable;
        emit BorrowableUpdated(token, borrowable);
    }

    // ---------- Interest accrual ----------

    /// @notice Utilization = borrowed / (borrowed + available liquidity),
    /// in bps. Available liquidity is simply the pool's own token balance.
    function utilizationBps(address token) public view returns (uint256) {
        ReserveState memory r = reserves[token];
        uint256 totalBorrowed = (r.totalScaledBorrow * r.borrowIndex) / WAD;
        uint256 available = IERC20(token).balanceOf(address(this));
        uint256 totalPool = totalBorrowed + available;
        if (totalPool == 0) return 0;
        return (totalBorrowed * BPS_DENOMINATOR) / totalPool;
    }

    /// @notice Current annualized borrow rate (bps) for `token` — flat at
    /// `baseRateBps` up to `optimalUtilizationBps`, then a much steeper
    /// slope beyond it, pushing utilization back down.
    function borrowRateBps(address token) public view returns (uint256) {
        InterestRateConfig memory c = rateConfigs[token];
        if (c.optimalUtilizationBps == 0) return c.baseRateBps; // rate curve not configured yet
        uint256 u = utilizationBps(token);
        if (u <= c.optimalUtilizationBps) {
            return c.baseRateBps + (c.slope1Bps * u) / c.optimalUtilizationBps;
        }
        uint256 excessU = u - c.optimalUtilizationBps;
        uint256 maxExcessU = BPS_DENOMINATOR - c.optimalUtilizationBps;
        return c.baseRateBps + c.slope1Bps + (c.slope2Bps * excessU) / maxExcessU;
    }

    /// @notice Current annualized supply rate (bps) — the share of borrower
    /// interest, net of the protocol's reserve factor, spread across
    /// suppliers via the utilization rate.
    function supplyRateBps(address token) public view returns (uint256) {
        uint256 u = utilizationBps(token);
        uint256 borrowRate = borrowRateBps(token);
        uint256 grossRate = (borrowRate * u) / BPS_DENOMINATOR;
        uint256 reserveFactor = rateConfigs[token].reserveFactorBps;
        return (grossRate * (BPS_DENOMINATOR - reserveFactor)) / BPS_DENOMINATOR;
    }

    /// @notice Projects both indices forward to now, without writing state
    /// — what `_accrue` would set them to. Used by every view that needs a
    /// live balance (accountData, supplyBalanceOf, borrowBalanceOf) so
    /// reads are always up to date even between transactions.
    function _projectedIndices(address token) internal view returns (uint256 liquidityIndex, uint256 borrowIndex) {
        ReserveState memory r = reserves[token];
        uint256 elapsed = block.timestamp - r.lastUpdateTimestamp;
        if (elapsed == 0) return (r.liquidityIndex, r.borrowIndex);
        uint256 bRate = borrowRateBps(token);
        uint256 sRate = supplyRateBps(token);
        borrowIndex = r.borrowIndex + (r.borrowIndex * bRate * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
        liquidityIndex = r.liquidityIndex + (r.liquidityIndex * sRate * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }

    /// @notice Writes the projected indices for `token`, realizing interest
    /// up to now. Called at the top of every action that reads or changes
    /// a balance for that token, so nothing ever acts on a stale index.
    function _accrue(address token) internal {
        ReserveState storage r = reserves[token];
        if (block.timestamp == r.lastUpdateTimestamp) return;
        (uint256 liquidityIndex, uint256 borrowIndex) = _projectedIndices(token);
        r.liquidityIndex = liquidityIndex;
        r.borrowIndex = borrowIndex;
        r.lastUpdateTimestamp = block.timestamp;
    }

    function supplyBalanceOf(address user, address token) public view returns (uint256) {
        (uint256 liquidityIndex, ) = _projectedIndices(token);
        return (userAssets[user][token].scaledSupplied * liquidityIndex) / WAD;
    }

    function borrowBalanceOf(address user, address token) public view returns (uint256) {
        (, uint256 borrowIndex) = _projectedIndices(token);
        return (userAssets[user][token].scaledBorrowed * borrowIndex) / WAD;
    }

    // ---------- User actions ----------

    function supply(address token, uint256 amount) external nonReentrant {
        require(assets[token].listed, "not listed");
        require(amount > 0, "amount=0");
        _accrue(token);
        (uint256 liquidityIndex, ) = _projectedIndices(token);
        userAssets[msg.sender][token].scaledSupplied += (amount * WAD) / liquidityIndex;
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Supplied(msg.sender, token, amount);
    }

    function withdraw(address token, uint256 amount) external nonReentrant {
        require(assets[token].listed, "not listed");
        _accrue(token);
        uint256 currentSupplied = supplyBalanceOf(msg.sender, token);
        require(amount > 0 && amount <= currentSupplied, "invalid amount");
        require(IERC20(token).balanceOf(address(this)) >= amount, "insufficient liquidity");
        (uint256 liquidityIndex, ) = _projectedIndices(token);
        userAssets[msg.sender][token].scaledSupplied -= (amount * WAD) / liquidityIndex;
        require(_isHealthy(msg.sender), "would breach collateral factor");
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, token, amount);
    }

    function borrow(address token, uint256 amount) external nonReentrant {
        AssetConfig memory cfg = assets[token];
        require(cfg.listed && cfg.borrowable, "not borrowable");
        require(amount > 0, "amount=0");
        require(IERC20(token).balanceOf(address(this)) >= amount, "insufficient liquidity");
        _accrue(token);
        (, uint256 borrowIndex) = _projectedIndices(token);
        uint256 scaledAmount = (amount * WAD) / borrowIndex;
        userAssets[msg.sender][token].scaledBorrowed += scaledAmount;
        reserves[token].totalScaledBorrow += scaledAmount;
        require(_isHealthy(msg.sender), "exceeds collateral limit");
        IERC20(token).safeTransfer(msg.sender, amount);
        emit Borrowed(msg.sender, token, amount);
    }

    function repay(address token, uint256 amount) external nonReentrant {
        _accrue(token);
        uint256 currentBorrowed = borrowBalanceOf(msg.sender, token);
        require(amount > 0 && amount <= currentBorrowed, "invalid amount");
        _reduceDebt(msg.sender, token, amount);
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Repaid(msg.sender, token, amount);
    }

    function _reduceDebt(address user, address token, uint256 amount) internal {
        (, uint256 borrowIndex) = _projectedIndices(token);
        uint256 scaledAmount = (amount * WAD) / borrowIndex;
        UserAsset storage pos = userAssets[user][token];
        // Rounding on the scaled conversion can leave 1 wei of scaled debt
        // after repaying what view math called "the full balance" — clear
        // it rather than leaving dust.
        if (scaledAmount >= pos.scaledBorrowed) {
            reserves[token].totalScaledBorrow -= pos.scaledBorrowed;
            pos.scaledBorrowed = 0;
        } else {
            pos.scaledBorrowed -= scaledAmount;
            reserves[token].totalScaledBorrow -= scaledAmount;
        }
    }

    // ---------- Liquidation ----------

    /// @notice Repay part of an unhealthy user's debt in `debtToken` and
    /// receive `collateralToken` from their supplied balance at a discount
    /// (`liquidationBonusBps`) — the standard incentive for a liquidator to
    /// keep the protocol solvent. Only callable once the position has
    /// crossed its liquidation threshold, not merely its collateral factor.
    function liquidate(address user, address debtToken, address collateralToken, uint256 repayAmount) external nonReentrant {
        require(assets[debtToken].listed && assets[collateralToken].listed, "not listed");
        _accrue(debtToken);
        _accrue(collateralToken);
        require(isLiquidatable(user), "position is healthy");

        uint256 currentDebt = borrowBalanceOf(user, debtToken);
        require(repayAmount > 0 && repayAmount <= currentDebt, "invalid repay amount");

        AssetConfig memory debtCfg = assets[debtToken];
        AssetConfig memory collateralCfg = assets[collateralToken];

        uint256 repayValueUsd = (repayAmount * debtCfg.priceInUsdc) / (10 ** debtCfg.decimals);
        uint256 seizeValueUsd = (repayValueUsd * (BPS_DENOMINATOR + collateralCfg.liquidationBonusBps)) / BPS_DENOMINATOR;
        uint256 collateralToSeize = (seizeValueUsd * (10 ** collateralCfg.decimals)) / collateralCfg.priceInUsdc;

        uint256 userCollateral = supplyBalanceOf(user, collateralToken);
        require(collateralToSeize <= userCollateral, "insufficient collateral in that asset");

        _reduceDebt(user, debtToken, repayAmount);
        (uint256 collateralLiquidityIndex, ) = _projectedIndices(collateralToken);
        userAssets[user][collateralToken].scaledSupplied -= (collateralToSeize * WAD) / collateralLiquidityIndex;

        IERC20(debtToken).safeTransferFrom(msg.sender, address(this), repayAmount);
        IERC20(collateralToken).safeTransfer(msg.sender, collateralToSeize);

        emit Liquidated(user, msg.sender, debtToken, collateralToken, repayAmount, collateralToSeize);
    }

    function isLiquidatable(address user) public view returns (bool) {
        (, uint256 liquidationValue, uint256 borrowValue) = _fullAccountData(user);
        return borrowValue > liquidationValue;
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

        address token = m.repayToken;
        _accrue(token);

        (uint256 collateralValue, uint256 borrowValueBefore) = accountData(user);
        require(collateralValue > 0, "no collateral");
        uint256 utilBefore = (borrowValueBefore * BPS_DENOMINATOR) / collateralValue;
        require(utilBefore > m.thresholdBps, "utilization below threshold");

        if (block.timestamp >= m.windowStart + 1 days) {
            m.windowStart = block.timestamp;
            m.spentToday = 0;
        }
        require(m.spentToday + amount <= m.dailyLimit, "exceeds daily limit");

        uint256 currentDebt = borrowBalanceOf(user, token);
        require(amount <= currentDebt, "exceeds debt");

        uint256 walletBalance = IERC20(token).balanceOf(user);
        require(walletBalance >= amount + m.reserveAmount, "would breach reserve");

        m.spentToday += amount;
        _reduceDebt(user, token, amount);
        IERC20(token).safeTransferFrom(user, address(this), amount);

        (uint256 collateralValueAfter, uint256 borrowValueAfter) = accountData(user);
        uint256 utilAfter = collateralValueAfter > 0 ? (borrowValueAfter * BPS_DENOMINATOR) / collateralValueAfter : 0;

        emit AgentRepaid(user, msg.sender, token, amount, utilBefore, utilAfter, borrowBalanceOf(user, token));
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

    /// @notice Collateral-factor-weighted collateral value and total
    /// borrowed value for `user`, both in USDC's smallest units, using
    /// live (projected) balances — this is what gates new borrows/withdrawals.
    function accountData(address user) public view returns (uint256 collateralValue, uint256 borrowValue) {
        (collateralValue, , borrowValue) = _fullAccountData(user);
    }

    /// @notice Same as `accountData` but also returns the
    /// liquidation-threshold-weighted collateral value, which is what
    /// decides `isLiquidatable` — always >= the collateral-factor value,
    /// giving a safety buffer between "can't borrow more" and "gets
    /// liquidated".
    function _fullAccountData(address user)
        internal
        view
        returns (uint256 collateralValue, uint256 liquidationValue, uint256 borrowValue)
    {
        uint256 len = assetList.length;
        for (uint256 i = 0; i < len; i++) {
            address token = assetList[i];
            AssetConfig memory cfg = assets[token];
            uint256 supplied = supplyBalanceOf(user, token);
            uint256 borrowed = borrowBalanceOf(user, token);
            if (supplied > 0) {
                uint256 value = (supplied * cfg.priceInUsdc) / (10 ** cfg.decimals);
                collateralValue += (value * cfg.collateralFactorBps) / BPS_DENOMINATOR;
                liquidationValue += (value * cfg.liquidationThresholdBps) / BPS_DENOMINATOR;
            }
            if (borrowed > 0) {
                borrowValue += (borrowed * cfg.priceInUsdc) / (10 ** cfg.decimals);
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
