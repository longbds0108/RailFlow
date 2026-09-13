// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Railflow Native USDC Money Market
/// @notice Isolated Arc Testnet lending market. Arc Testnet represents USDC
/// as the native currency, so supply/repay use msg.value and borrow/withdraw
/// send native value directly to the caller.
/// @dev This testnet market has no admin, upgrade, liquidation, or fee path.
/// Supply acts as collateral for same-asset borrowing at a 75% LTV.
contract RailflowMoneyMarket {
    uint256 public constant BPS = 10_000;
    uint256 public constant COLLATERAL_FACTOR_BPS = 7_500;
    uint256 public constant BASE_BORROW_APY_BPS = 500;
    uint256 public constant UTILIZATION_SLOPE_BPS = 1_500;
    uint256 public constant RESERVE_FACTOR_BPS = 2_000;

    mapping(address => uint256) public supplied;
    mapping(address => uint256) public borrowed;
    uint256 public totalSupplied;
    uint256 public totalBorrowed;

    event Supplied(address indexed account, uint256 amount, uint256 balance, uint256 timestamp);
    event Withdrawn(address indexed account, uint256 amount, uint256 balance, uint256 timestamp);
    event Borrowed(address indexed account, uint256 amount, uint256 debt, uint256 timestamp);
    event Repaid(address indexed account, uint256 amount, uint256 debt, uint256 timestamp);

    function supply() external payable {
        require(msg.value > 0, "Supply amount must be greater than zero");
        supplied[msg.sender] += msg.value;
        totalSupplied += msg.value;
        emit Supplied(msg.sender, msg.value, supplied[msg.sender], block.timestamp);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "Withdraw amount must be greater than zero");
        uint256 balance = supplied[msg.sender];
        require(amount <= balance, "Insufficient supplied balance");
        require(address(this).balance - totalBorrowed >= amount, "Insufficient available liquidity");
        uint256 remaining = balance - amount;
        require(remaining * COLLATERAL_FACTOR_BPS >= borrowed[msg.sender] * BPS, "Would exceed borrow limit");
        supplied[msg.sender] = remaining;
        totalSupplied -= amount;
        _send(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, remaining, block.timestamp);
    }

    function borrow(uint256 amount) external {
        require(amount > 0, "Borrow amount must be greater than zero");
        require(address(this).balance - totalBorrowed >= amount, "Insufficient available liquidity");
        uint256 newDebt = borrowed[msg.sender] + amount;
        require(supplied[msg.sender] * COLLATERAL_FACTOR_BPS >= newDebt * BPS, "Borrow amount exceeds collateral");
        borrowed[msg.sender] = newDebt;
        totalBorrowed += amount;
        _send(msg.sender, amount);
        emit Borrowed(msg.sender, amount, newDebt, block.timestamp);
    }

    function repay() external payable {
        require(msg.value > 0, "Repay amount must be greater than zero");
        uint256 debt = borrowed[msg.sender];
        require(debt > 0, "No outstanding debt");
        uint256 amount = msg.value > debt ? debt : msg.value;
        borrowed[msg.sender] = debt - amount;
        totalBorrowed -= amount;
        // Any accidental overpayment is returned immediately.
        if (msg.value > amount) _send(msg.sender, msg.value - amount);
        emit Repaid(msg.sender, amount, borrowed[msg.sender], block.timestamp);
    }

    function utilizationBps() public view returns (uint256) {
        if (totalSupplied == 0) return 0;
        return totalBorrowed * BPS / totalSupplied;
    }

    function borrowApyBps() public view returns (uint256) {
        return BASE_BORROW_APY_BPS + utilizationBps() * UTILIZATION_SLOPE_BPS / BPS;
    }

    function supplyApyBps() public view returns (uint256) {
        return borrowApyBps() * utilizationBps() * (BPS - RESERVE_FACTOR_BPS) / BPS / BPS;
    }

    function availableLiquidity() public view returns (uint256) {
        return address(this).balance - totalBorrowed;
    }

    function borrowCapacity(address account) public view returns (uint256) {
        uint256 limit = supplied[account] * COLLATERAL_FACTOR_BPS / BPS;
        uint256 debt = borrowed[account];
        return limit > debt ? limit - debt : 0;
    }

    function marketData() external view returns (
        uint256 suppliedTotal,
        uint256 borrowedTotal,
        uint256 liquidity,
        uint256 utilization,
        uint256 supplyApy,
        uint256 borrowApy
    ) {
        return (totalSupplied, totalBorrowed, availableLiquidity(), utilizationBps(), supplyApyBps(), borrowApyBps());
    }

    function userPosition(address account) external view returns (uint256 suppliedAmount, uint256 borrowedAmount, uint256 capacity) {
        return (supplied[account], borrowed[account], borrowCapacity(account));
    }

    function _send(address account, uint256 amount) private {
        (bool success, ) = account.call{value: amount}("");
        require(success, "Native transfer failed");
    }

    receive() external payable {
        revert("Use supply() or repay()");
    }
}
