// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RailFlowTBill
/// @notice A real, NAV-appreciating tokenized bill on Arc Testnet: NAV
/// starts at 1.0 USDC/unit and grows continuously at the owner-set APY.
/// Subscribe deposits USDC for units at the live NAV; redeem burns units
/// for USDC at the live NAV. Always liquid (no subscription windows or
/// settlement delay) — a deliberate simplification versus a real T-bill
/// fund's cut-offs, kept honest by not pretending otherwise anywhere in
/// the contract or its events.
/// @dev Testnet demo: APY is owner-set, and redemptions are paid from a
/// reserve the owner (or anyone) funds via fundReserves — same pattern as
/// RailFlowYieldVault's reward reserve.
contract RailFlowTBill is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant RAY = 1e18;

    IERC20 public immutable usdc;
    uint256 public apyBps;
    uint256 public navRay; // NAV per unit, scaled by 1e18
    uint256 public lastAccrualAt;

    mapping(address => uint256) public unitsOf;
    uint256 public totalUnits;

    event ApySet(uint256 apyBps);
    event ReservesFunded(address indexed from, uint256 amount);
    event Subscribed(address indexed user, uint256 usdcIn, uint256 unitsOut, uint256 nav);
    event Redeemed(address indexed user, uint256 unitsIn, uint256 usdcOut, uint256 nav);

    constructor(address _owner, address _usdc, uint256 _apyBps) Ownable(_owner) {
        usdc = IERC20(_usdc);
        apyBps = _apyBps;
        navRay = RAY;
        lastAccrualAt = block.timestamp;
    }

    function _accrue() internal {
        if (block.timestamp <= lastAccrualAt) return;
        navRay = currentNav();
        lastAccrualAt = block.timestamp;
    }

    /// @notice Live NAV per unit (1e18-scaled), continuously accrued —
    /// callable at any time without needing a transaction first.
    function currentNav() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrualAt;
        if (elapsed == 0) return navRay;
        return navRay + (navRay * apyBps * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }

    function setApy(uint256 _apyBps) external onlyOwner {
        _accrue();
        apyBps = _apyBps;
        emit ApySet(_apyBps);
    }

    function fundReserves(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit ReservesFunded(msg.sender, amount);
    }

    function subscribe(uint256 usdcAmount) external nonReentrant {
        require(usdcAmount > 0, "amount=0");
        _accrue();
        uint256 units = (usdcAmount * RAY) / navRay;
        unitsOf[msg.sender] += units;
        totalUnits += units;
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        emit Subscribed(msg.sender, usdcAmount, units, navRay);
    }

    function redeem(uint256 units) external nonReentrant {
        require(units > 0 && units <= unitsOf[msg.sender], "invalid units");
        _accrue();
        uint256 usdcOut = (units * navRay) / RAY;
        unitsOf[msg.sender] -= units;
        totalUnits -= units;
        require(usdc.balanceOf(address(this)) >= usdcOut, "reserve can't cover redemption yet");
        usdc.safeTransfer(msg.sender, usdcOut);
        emit Redeemed(msg.sender, units, usdcOut, navRay);
    }
}
