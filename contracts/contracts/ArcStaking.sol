// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ArcStaking
/// @notice Stake an allowed ERC-20 (e.g. USDC or EURC) and earn USDC rewards at a
///         fixed APY with linear per-second accrual. Owner funds/withdraws the USDC
///         reward pool and configures APY / allowed tokens.
///
/// @dev Decimals / value assumption (testnet demo):
///      USDC and EURC both use 6 decimals and the reward token (USDC) is 6 decimals.
///      Rewards are computed directly from the staked principal's smallest units and
///      paid out in USDC smallest units. We assume a 1:1 token value between every
///      stakable token and USDC, so 1 staked unit accrues reward as if it were 1 USDC
///      unit. This is fine for a demo because all tokens share 6 decimals; a production
///      system would price each token via an oracle before computing rewards.
contract ArcStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Reward token paid to stakers (USDC, 6 decimals).
    IERC20 public immutable rewardToken;

    /// @notice Annual percentage yield in basis points (e.g. 1000 = 10%).
    uint256 public apyBps;

    /// @notice Optional lock duration (seconds) before staked principal can be unstaked.
    uint256 public lockSeconds;

    /// @notice Minimum stake amount (in the staked token's smallest units).
    uint256 public minStake;

    /// @notice Basis-points denominator.
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Seconds in a year used for linear APY accrual.
    uint256 public constant YEAR_SECONDS = 365 days;

    /// @notice Whether a token is allowed to be staked.
    mapping(address => bool) public allowedToken;

    struct Stake {
        uint256 principal; // staked amount, token smallest units
        uint256 rewardDebt; // accrued-but-unclaimed reward (USDC units) at lastUpdate
        uint256 lastUpdate; // timestamp of last accrual checkpoint
        uint256 lockedUntil; // timestamp until which principal is locked
    }

    /// @notice user => token => stake position.
    mapping(address => mapping(address => Stake)) private _stakes;

    event Staked(address indexed user, address indexed token, uint256 amount);
    event Unstaked(address indexed user, address indexed token, uint256 amount);
    event Claimed(address indexed user, address indexed token, uint256 reward);

    event ApyUpdated(uint256 apyBps);
    event AllowedTokenSet(address indexed token, bool allowed);
    event RewardPoolFunded(address indexed from, uint256 amount);
    event RewardPoolWithdrawn(address indexed to, uint256 amount);

    error TokenNotAllowed(address token);
    error AmountZero();
    error BelowMinStake(uint256 amount, uint256 minStake);
    error InsufficientStake(uint256 requested, uint256 available);
    error StillLocked(uint256 lockedUntil);
    error NothingToClaim();
    error InsufficientRewardPool(uint256 needed, uint256 available);

    /// @param _rewardToken USDC token address used to pay rewards.
    /// @param _apyBps Fixed APY in basis points.
    /// @param _lockSeconds Lock duration in seconds (0 = no lock).
    /// @param _minStake Minimum stake amount in token smallest units.
    constructor(
        address _rewardToken,
        uint256 _apyBps,
        uint256 _lockSeconds,
        uint256 _minStake
    ) Ownable(msg.sender) {
        require(_rewardToken != address(0), "reward token zero");
        rewardToken = IERC20(_rewardToken);
        apyBps = _apyBps;
        lockSeconds = _lockSeconds;
        minStake = _minStake;
    }

    // ----------------------------------------------------------------------
    // User actions
    // ----------------------------------------------------------------------

    /// @notice Stake `amount` of an allowed `token`. Accrued rewards are checkpointed first.
    function stake(address token, uint256 amount) external nonReentrant {
        if (!allowedToken[token]) revert TokenNotAllowed(token);
        if (amount == 0) revert AmountZero();

        Stake storage s = _stakes[msg.sender][token];
        _accrue(s);

        uint256 newPrincipal = s.principal + amount;
        if (newPrincipal < minStake) revert BelowMinStake(newPrincipal, minStake);

        s.principal = newPrincipal;
        s.lockedUntil = block.timestamp + lockSeconds;

        // Track USDC held as principal so it is never counted as reward pool.
        if (token == address(rewardToken)) {
            _usdcStakedTotal += amount;
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, token, amount);
    }

    /// @notice Unstake `amount` of `token` principal. Accrued rewards are checkpointed
    ///         (kept as rewardDebt, claim separately). Remaining principal must be 0 or >= minStake.
    function unstake(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();

        Stake storage s = _stakes[msg.sender][token];
        if (amount > s.principal) revert InsufficientStake(amount, s.principal);
        if (block.timestamp < s.lockedUntil) revert StillLocked(s.lockedUntil);

        _accrue(s);

        uint256 remaining = s.principal - amount;
        if (remaining != 0 && remaining < minStake) {
            revert BelowMinStake(remaining, minStake);
        }
        s.principal = remaining;

        if (token == address(rewardToken)) {
            _usdcStakedTotal -= amount;
        }

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, token, amount);
    }

    /// @notice Claim accrued USDC rewards for `token`.
    function claim(address token) external nonReentrant {
        Stake storage s = _stakes[msg.sender][token];
        _accrue(s);

        uint256 reward = s.rewardDebt;
        if (reward == 0) revert NothingToClaim();

        uint256 pool = rewardToken.balanceOf(address(this));
        // Exclude USDC that is itself staked principal so we never pay rewards out of stakes.
        // For USDC the contract holds principal + reward pool together; staked USDC must
        // remain withdrawable, so guard the available pool against owed principal.
        // (Demo simplification: tracked via _usdcStakedTotal.)
        uint256 available = pool > _usdcStakedTotal ? pool - _usdcStakedTotal : 0;
        if (reward > available) revert InsufficientRewardPool(reward, available);

        s.rewardDebt = 0;
        rewardToken.safeTransfer(msg.sender, reward);

        emit Claimed(msg.sender, token, reward);
    }

    // ----------------------------------------------------------------------
    // Views
    // ----------------------------------------------------------------------

    /// @notice Total pending (claimable) reward for `user` on `token`, in USDC smallest units.
    function pendingReward(address user, address token) public view returns (uint256) {
        Stake storage s = _stakes[user][token];
        return s.rewardDebt + _earned(s);
    }

    /// @notice Returns the full stake position for `user` on `token`.
    /// @return principal Staked amount (token units).
    /// @return reward Total pending reward (USDC units).
    /// @return lastUpdate Last accrual checkpoint timestamp.
    /// @return lockedUntil Timestamp until which principal is locked.
    function stakeInfo(address user, address token)
        external
        view
        returns (uint256 principal, uint256 reward, uint256 lastUpdate, uint256 lockedUntil)
    {
        Stake storage s = _stakes[user][token];
        principal = s.principal;
        reward = s.rewardDebt + _earned(s);
        lastUpdate = s.lastUpdate;
        lockedUntil = s.lockedUntil;
    }

    /// @notice USDC available to pay rewards (excludes USDC held as staked principal).
    function rewardPoolBalance() external view returns (uint256) {
        uint256 pool = rewardToken.balanceOf(address(this));
        return pool > _usdcStakedTotal ? pool - _usdcStakedTotal : 0;
    }

    // ----------------------------------------------------------------------
    // Owner config / reward pool
    // ----------------------------------------------------------------------

    /// @notice Owner funds the USDC reward pool.
    function fundRewardPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountZero();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardPoolFunded(msg.sender, amount);
    }

    /// @notice Owner withdraws unused USDC from the reward pool (cannot touch staked principal).
    function withdrawRewardPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountZero();
        uint256 pool = rewardToken.balanceOf(address(this));
        uint256 available = pool > _usdcStakedTotal ? pool - _usdcStakedTotal : 0;
        if (amount > available) revert InsufficientRewardPool(amount, available);
        rewardToken.safeTransfer(msg.sender, amount);
        emit RewardPoolWithdrawn(msg.sender, amount);
    }

    /// @notice Owner sets the APY (basis points).
    function setApyBps(uint256 _apyBps) external onlyOwner {
        apyBps = _apyBps;
        emit ApyUpdated(_apyBps);
    }

    /// @notice Owner allows/disallows a stakable token.
    function setAllowedToken(address token, bool allowed) external onlyOwner {
        require(token != address(0), "token zero");
        allowedToken[token] = allowed;
        emit AllowedTokenSet(token, allowed);
    }

    /// @notice Owner sets the minimum stake amount.
    function setMinStake(uint256 _minStake) external onlyOwner {
        minStake = _minStake;
    }

    /// @notice Owner sets the lock duration in seconds.
    function setLockSeconds(uint256 _lockSeconds) external onlyOwner {
        lockSeconds = _lockSeconds;
    }

    // ----------------------------------------------------------------------
    // Internal accounting
    // ----------------------------------------------------------------------

    /// @dev Running total of USDC held as staked principal, so reward-pool views never
    ///      count user-staked USDC as available rewards.
    uint256 private _usdcStakedTotal;

    /// @dev Reward earned since the last checkpoint, in USDC smallest units.
    ///      reward = principal * apyBps / 10000 * elapsed / 365 days
    function _earned(Stake storage s) private view returns (uint256) {
        if (s.principal == 0 || s.lastUpdate == 0) return 0;
        uint256 elapsed = block.timestamp - s.lastUpdate;
        if (elapsed == 0) return 0;
        return (s.principal * apyBps * elapsed) / (BPS_DENOMINATOR * YEAR_SECONDS);
    }

    /// @dev Checkpoint: fold earned reward into rewardDebt and reset the timer.
    function _accrue(Stake storage s) private {
        uint256 earned = _earned(s);
        if (earned != 0) {
            s.rewardDebt += earned;
        }
        s.lastUpdate = block.timestamp;
    }
}
