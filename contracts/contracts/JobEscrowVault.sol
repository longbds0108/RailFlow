// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title JobEscrowVault
/// @notice Self-contained, OTC-style job escrow: the client's budget AND the
///         provider's stake are both locked here (unlike the ERC-8183
///         reference contract, which only escrows the client's side) so their
///         combined principal can earn a fixed demo APY while the job is in
///         progress. On successful completion the accrued yield is split
///         50/50 between client and provider; on rejection or expiry, both
///         the budget and the stake go back to the client — the stake acting
///         as a penalty paid by the provider — and no yield is paid.
///
/// @dev Demo yield only: Arc Testnet has no real external yield source to
///      deposit into, so — exactly like ArcStaking.sol — the "yield" paid out
///      comes from a USDC reward pool the owner funds upfront at a fixed
///      linear APY. `_principalHeld` tracks USDC held as live job principal
///      so reward-pool views/withdrawals can never touch it.
contract JobEscrowVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token; // USDC, 6 decimals

    uint256 public apyBps; // fixed demo APY, basis points
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant YEAR_SECONDS = 365 days;

    // Index-matched to frontend/lib/jobsAbi.js JOB_STATUS_NAMES /
    // config/arc.json jobs.statusNames, kept the same as the ERC-8183
    // reference contract's enum for UI continuity.
    enum Status {
        Open, // client funded the budget; waiting for the provider to lock a stake (if any is required)
        Funded, // both sides locked; job in progress, yield accruing
        Submitted, // provider submitted a deliverable
        Completed,
        Rejected,
        Expired
    }

    struct Job {
        address client;
        address provider;
        address evaluator;
        uint256 budget;
        uint256 requiredStake;
        uint256 expiredAt;
        uint256 activatedAt; // yield accrual start; 0 until Funded
        Status status;
        string description;
    }

    uint256 public nextJobId = 1;
    mapping(uint256 => Job) public jobs;

    uint256 private _principalHeld;

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed provider,
        address evaluator,
        uint256 budget,
        uint256 requiredStake,
        uint256 expiredAt,
        string description
    );
    event StakeLocked(uint256 indexed jobId, address indexed provider, uint256 amount);
    event Submitted(uint256 indexed jobId, bytes32 deliverable);
    event Resolved(uint256 indexed jobId, bool approved, uint256 yieldPaid);
    event JobExpired(uint256 indexed jobId);
    event ApyUpdated(uint256 apyBps);
    event RewardPoolFunded(address indexed from, uint256 amount);
    event RewardPoolWithdrawn(address indexed to, uint256 amount);

    error NotClient();
    error NotProvider();
    error NotEvaluator();
    error WrongStatus(Status status);
    error AmountZero();
    error ProviderZero();
    error NotExpiredYet();
    error InsufficientRewardPool(uint256 needed, uint256 available);

    constructor(address _token, uint256 _apyBps) Ownable(msg.sender) {
        require(_token != address(0), "token zero");
        token = IERC20(_token);
        apyBps = _apyBps;
    }

    // ----------------------------------------------------------------------
    // Job lifecycle
    // ----------------------------------------------------------------------

    /// @notice Client creates a job and locks the budget immediately. If no
    ///         stake is required (`requiredStake == 0`) the job is
    ///         immediately `Funded` and yield starts accruing right away;
    ///         otherwise it stays `Open` until the provider locks the stake.
    function createJob(
        address provider,
        address evaluator,
        uint256 budget,
        uint256 requiredStake,
        uint256 expiredAt,
        string calldata description
    ) external nonReentrant returns (uint256 jobId) {
        if (budget == 0) revert AmountZero();
        if (provider == address(0)) revert ProviderZero();

        jobId = nextJobId++;
        bool needsStake = requiredStake > 0;
        address resolvedEvaluator = evaluator == address(0) ? msg.sender : evaluator;

        jobs[jobId] = Job({
            client: msg.sender,
            provider: provider,
            evaluator: resolvedEvaluator,
            budget: budget,
            requiredStake: requiredStake,
            expiredAt: expiredAt,
            activatedAt: needsStake ? 0 : block.timestamp,
            status: needsStake ? Status.Open : Status.Funded,
            description: description
        });

        _principalHeld += budget;
        token.safeTransferFrom(msg.sender, address(this), budget);

        emit JobCreated(jobId, msg.sender, provider, resolvedEvaluator, budget, requiredStake, expiredAt, description);
    }

    /// @notice Provider locks the required stake, activating the job.
    function lockStake(uint256 jobId) external nonReentrant {
        Job storage j = jobs[jobId];
        if (msg.sender != j.provider) revert NotProvider();
        if (j.status != Status.Open) revert WrongStatus(j.status);

        j.status = Status.Funded;
        j.activatedAt = block.timestamp;
        _principalHeld += j.requiredStake;
        token.safeTransferFrom(msg.sender, address(this), j.requiredStake);

        emit StakeLocked(jobId, msg.sender, j.requiredStake);
    }

    /// @notice Provider submits a deliverable — only its hash goes on-chain.
    function submit(uint256 jobId, bytes32 deliverable) external {
        Job storage j = jobs[jobId];
        if (msg.sender != j.provider) revert NotProvider();
        if (j.status != Status.Funded) revert WrongStatus(j.status);
        j.status = Status.Submitted;
        emit Submitted(jobId, deliverable);
    }

    /// @notice Evaluator resolves a submitted job: approve releases budget +
    ///         stake + half the accrued yield to the provider (client gets
    ///         the other half); reject sends budget + stake back to the
    ///         client with no yield.
    function resolve(uint256 jobId, bool approved) external nonReentrant {
        Job storage j = jobs[jobId];
        if (msg.sender != j.evaluator) revert NotEvaluator();
        if (j.status != Status.Submitted) revert WrongStatus(j.status);

        uint256 principal = j.budget + j.requiredStake;

        if (approved) {
            // Check reward-pool headroom BEFORE decrementing _principalHeld —
            // otherwise this job's own (not-yet-paid-out) principal would
            // briefly look like free reward money and pass the check even
            // with an empty pool, only to revert on the actual transfer.
            uint256 yieldAmount = _earned(principal, j.activatedAt);
            if (yieldAmount > 0) {
                uint256 pool = rewardPoolBalance();
                if (yieldAmount > pool) revert InsufficientRewardPool(yieldAmount, pool);
            }

            j.status = Status.Completed;
            _principalHeld -= principal;
            uint256 half = yieldAmount / 2;

            token.safeTransfer(j.provider, principal + half);
            if (yieldAmount - half > 0) token.safeTransfer(j.client, yieldAmount - half);

            emit Resolved(jobId, true, yieldAmount);
        } else {
            j.status = Status.Rejected;
            _principalHeld -= principal;
            token.safeTransfer(j.client, principal);
            emit Resolved(jobId, false, 0);
        }
    }

    /// @notice Permissionlessly expire a job that missed its deadline
    ///         without ever reaching a final state — budget and any locked
    ///         stake go back to the client, no yield paid.
    function expire(uint256 jobId) external nonReentrant {
        Job storage j = jobs[jobId];
        if (
            j.status == Status.Completed || j.status == Status.Rejected || j.status == Status.Expired
        ) revert WrongStatus(j.status);
        if (block.timestamp < j.expiredAt) revert NotExpiredYet();

        // A job stuck at Open never had its stake actually collected.
        uint256 principal = j.status == Status.Open ? j.budget : j.budget + j.requiredStake;
        _principalHeld -= principal;

        j.status = Status.Expired;
        token.safeTransfer(j.client, principal);

        emit JobExpired(jobId);
    }

    // ----------------------------------------------------------------------
    // Views
    // ----------------------------------------------------------------------

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    /// @notice Demo yield accrued so far on `jobId`'s combined principal, in
    ///         USDC smallest units. 0 before the job is `Funded`.
    function pendingYield(uint256 jobId) external view returns (uint256) {
        Job storage j = jobs[jobId];
        return _earned(j.budget + j.requiredStake, j.activatedAt);
    }

    /// @notice USDC available to pay yield (excludes USDC held as live job principal).
    function rewardPoolBalance() public view returns (uint256) {
        uint256 bal = token.balanceOf(address(this));
        return bal > _principalHeld ? bal - _principalHeld : 0;
    }

    function _earned(uint256 principal, uint256 activatedAt) private view returns (uint256) {
        if (activatedAt == 0 || principal == 0) return 0;
        uint256 elapsed = block.timestamp - activatedAt;
        return (principal * apyBps * elapsed) / (BPS_DENOMINATOR * YEAR_SECONDS);
    }

    // ----------------------------------------------------------------------
    // Owner: reward pool + APY
    // ----------------------------------------------------------------------

    function fundRewardPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountZero();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardPoolFunded(msg.sender, amount);
    }

    function withdrawRewardPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert AmountZero();
        uint256 available = rewardPoolBalance();
        if (amount > available) revert InsufficientRewardPool(amount, available);
        token.safeTransfer(msg.sender, amount);
        emit RewardPoolWithdrawn(msg.sender, amount);
    }

    function setApyBps(uint256 _apyBps) external onlyOwner {
        apyBps = _apyBps;
        emit ApyUpdated(_apyBps);
    }
}
