// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LendingBorrowing
/// @notice Single-pair collateralized lending for Arc Testnet: deposit cirBTC
/// as collateral to borrow USDC against it, modelled on Circle's
/// arc-defi-lend-borrow reference (github.com/circlefin/arc-defi-lend-borrow).
/// @dev Testnet demo only: interest-free, one open loan per address, and
/// collateral is priced via an owner-set rate rather than a live oracle —
/// the same simplifications the reference implementation documents.
contract LendingBorrowing is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken; // cirBTC
    IERC20 public immutable borrowToken; // USDC

    uint8 public immutable collateralDecimals;
    uint8 public immutable borrowDecimals;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Share of collateral value a borrower may draw, in basis points.
    uint256 public collateralFactorBps = 5_000; // 50%

    /// @notice Price of 1 whole collateral token in borrow-token units,
    /// scaled to `borrowDecimals` (e.g. cirBTC/USDC). No oracle on testnet,
    /// so the owner sets this directly — see contract-level dev note.
    uint256 public collateralPrice;

    struct Position {
        uint256 collateral; // collateralToken smallest units
        uint256 borrowed; // borrowToken smallest units
    }

    mapping(address => Position) public positions;

    event CollateralDeposited(address indexed user, uint256 amount);
    event CollateralWithdrawn(address indexed user, uint256 amount);
    event LoanTaken(address indexed user, uint256 amount);
    event LoanRepaid(address indexed user, uint256 amount);
    event PoolFunded(address indexed from, uint256 amount);
    event CollateralFactorUpdated(uint256 newFactorBps);
    event CollateralPriceUpdated(uint256 newPrice);

    constructor(address _collateralToken, address _borrowToken, uint256 _collateralPrice, address _owner)
        Ownable(_owner)
    {
        require(_collateralToken != address(0) && _borrowToken != address(0), "zero token address");
        collateralToken = IERC20(_collateralToken);
        borrowToken = IERC20(_borrowToken);
        collateralDecimals = IERC20Metadata(_collateralToken).decimals();
        borrowDecimals = IERC20Metadata(_borrowToken).decimals();
        collateralPrice = _collateralPrice;
    }

    /// @notice Lock `amount` of cirBTC as collateral.
    function depositCollateral(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        positions[msg.sender].collateral += amount;
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        emit CollateralDeposited(msg.sender, amount);
    }

    /// @notice Maximum total USDC a user may have borrowed given their
    /// current collateral and the collateral factor.
    function maxBorrow(address user) public view returns (uint256) {
        uint256 value = _collateralValue(positions[user].collateral);
        return (value * collateralFactorBps) / BPS_DENOMINATOR;
    }

    /// @notice Remaining USDC a user can still draw right now.
    function availableToBorrow(address user) external view returns (uint256) {
        uint256 max = maxBorrow(user);
        uint256 borrowed = positions[user].borrowed;
        return max > borrowed ? max - borrowed : 0;
    }

    /// @notice Borrow `amount` of USDC against deposited collateral.
    function takeLoan(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        Position storage p = positions[msg.sender];
        uint256 newBorrowed = p.borrowed + amount;
        require(newBorrowed <= maxBorrow(msg.sender), "exceeds collateral limit");
        require(borrowToken.balanceOf(address(this)) >= amount, "insufficient pool liquidity");
        p.borrowed = newBorrowed;
        borrowToken.safeTransfer(msg.sender, amount);
        emit LoanTaken(msg.sender, amount);
    }

    /// @notice Repay up to the full outstanding USDC loan. Interest-free, so
    /// repaying `borrowed` in full clears the position.
    function repayLoan(uint256 amount) external nonReentrant {
        Position storage p = positions[msg.sender];
        require(amount > 0 && amount <= p.borrowed, "invalid repay amount");
        p.borrowed -= amount;
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);
        emit LoanRepaid(msg.sender, amount);
    }

    /// @notice Withdraw `amount` of cirBTC, as long as any remaining
    /// collateral still covers the outstanding loan.
    function withdrawCollateral(uint256 amount) external nonReentrant {
        Position storage p = positions[msg.sender];
        require(amount > 0 && amount <= p.collateral, "invalid withdraw amount");
        uint256 remaining = p.collateral - amount;
        uint256 remainingMaxBorrow = (_collateralValue(remaining) * collateralFactorBps) / BPS_DENOMINATOR;
        require(p.borrowed <= remainingMaxBorrow, "would breach collateral factor");
        p.collateral = remaining;
        collateralToken.safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, amount);
    }

    /// @notice Owner tops up the USDC pool that loans are drawn from.
    function fundPool(uint256 amount) external onlyOwner {
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(msg.sender, amount);
    }

    function setCollateralFactor(uint256 newFactorBps) external onlyOwner {
        require(newFactorBps <= BPS_DENOMINATOR, "factor>100%");
        collateralFactorBps = newFactorBps;
        emit CollateralFactorUpdated(newFactorBps);
    }

    /// @dev Testnet stand-in for a price oracle — see contract-level note.
    function setCollateralPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "price=0");
        collateralPrice = newPrice;
        emit CollateralPriceUpdated(newPrice);
    }

    function _collateralValue(uint256 collateralAmount) private view returns (uint256) {
        return (collateralAmount * collateralPrice) / (10 ** collateralDecimals);
    }
}
