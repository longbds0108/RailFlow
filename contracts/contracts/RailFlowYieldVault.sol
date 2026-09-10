// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RailFlowYieldVault
/// @notice Real fixed-term, fixed-rate vaults on Arc Testnet: deposit one
/// asset, earn simple interest at the vault's APY, and withdraw principal +
/// interest once the lock period is over. No early exit, matching the "you
/// know exactly what you're paid for the lock-up" pitch on the Yield page.
/// @dev Testnet demo: APY is owner-set rather than sourced from organic
/// trading activity, and interest is paid from a reserve the owner funds
/// per vault (see fundRewards) — the same honesty pattern as
/// RailFlowLendingPool's owner-set asset prices. One open position per
/// vault per user keeps the accounting simple.
contract RailFlowYieldVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VaultConfig {
        address asset;
        uint256 apyBps; // simple annual rate, in bps
        uint256 lockSeconds;
        bool active;
    }

    struct Position {
        uint256 principal;
        uint256 depositedAt;
        uint256 unlocksAt;
    }

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    VaultConfig[] public vaults;
    mapping(uint256 => mapping(address => Position)) public positions; // vaultId => user => position

    event VaultCreated(uint256 indexed vaultId, address asset, uint256 apyBps, uint256 lockSeconds);
    event RewardsFunded(uint256 indexed vaultId, uint256 amount);
    event Deposited(uint256 indexed vaultId, address indexed user, uint256 amount, uint256 unlocksAt);
    event Withdrawn(uint256 indexed vaultId, address indexed user, uint256 principal, uint256 interest);

    constructor(address _owner) Ownable(_owner) {}

    function createVault(address asset, uint256 apyBps, uint256 lockSeconds) external onlyOwner returns (uint256 vaultId) {
        require(asset != address(0), "zero asset");
        vaultId = vaults.length;
        vaults.push(VaultConfig({ asset: asset, apyBps: apyBps, lockSeconds: lockSeconds, active: true }));
        emit VaultCreated(vaultId, asset, apyBps, lockSeconds);
    }

    function setVaultActive(uint256 vaultId, bool active) external onlyOwner {
        vaults[vaultId].active = active;
    }

    /// @notice Top up the reserve a vault pays interest from. Anyone can
    /// call this (not just the owner) so the reserve can be replenished by
    /// whoever wants the vault to keep honoring withdrawals.
    function fundRewards(uint256 vaultId, uint256 amount) external nonReentrant {
        VaultConfig memory cfg = vaults[vaultId];
        require(cfg.asset != address(0), "no such vault");
        require(amount > 0, "amount=0");
        IERC20(cfg.asset).safeTransferFrom(msg.sender, address(this), amount);
        emit RewardsFunded(vaultId, amount);
    }

    function deposit(uint256 vaultId, uint256 amount) external nonReentrant {
        VaultConfig memory cfg = vaults[vaultId];
        require(cfg.active, "vault inactive");
        require(amount > 0, "amount=0");
        Position storage pos = positions[vaultId][msg.sender];
        require(pos.principal == 0, "already has an open position in this vault");

        pos.principal = amount;
        pos.depositedAt = block.timestamp;
        pos.unlocksAt = block.timestamp + cfg.lockSeconds;

        IERC20(cfg.asset).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(vaultId, msg.sender, amount, pos.unlocksAt);
    }

    /// @notice Simple (non-compounding) interest accrued so far. Keeps
    /// accruing past `unlocksAt` if left unclaimed, so waiting to withdraw
    /// never forfeits interest.
    function pendingInterest(uint256 vaultId, address user) public view returns (uint256) {
        Position memory pos = positions[vaultId][user];
        if (pos.principal == 0) return 0;
        uint256 elapsed = block.timestamp - pos.depositedAt;
        uint256 apyBps = vaults[vaultId].apyBps;
        return (pos.principal * apyBps * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }

    function withdraw(uint256 vaultId) external nonReentrant {
        Position storage pos = positions[vaultId][msg.sender];
        require(pos.principal > 0, "no open position");
        require(block.timestamp >= pos.unlocksAt, "still locked");

        uint256 interest = pendingInterest(vaultId, msg.sender);
        uint256 principal = pos.principal;
        pos.principal = 0;
        pos.depositedAt = 0;
        pos.unlocksAt = 0;

        address asset = vaults[vaultId].asset;
        uint256 payout = principal + interest;
        require(IERC20(asset).balanceOf(address(this)) >= payout, "vault reserve can't cover interest yet");
        IERC20(asset).safeTransfer(msg.sender, payout);
        emit Withdrawn(vaultId, msg.sender, principal, interest);
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }
}
