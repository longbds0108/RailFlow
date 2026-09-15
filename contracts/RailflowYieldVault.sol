// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Railflow Yield Vault
/// @notice Simple vault for deposits with basic yield calculation on Arc Testnet.
contract RailflowYieldVault {
    mapping(address => uint256) public depositsOf;
    mapping(address => uint256) public lastDepositTime;
    uint256 public totalDeposits;
    uint256 public yieldRateBps = 500; // 5% APY in basis points

    address public owner;

    event Deposited(address indexed account, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed account, uint256 amount, uint256 yieldEarned);
    event YieldRateUpdated(uint256 newRate);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /// @notice Deposit USDC into the yield vault.
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be > 0");
        depositsOf[msg.sender] += msg.value;
        lastDepositTime[msg.sender] = block.timestamp;
        totalDeposits += msg.value;
        emit Deposited(msg.sender, msg.value, depositsOf[msg.sender]);
    }

    /// @notice Withdraw USDC and claim yield.
    function withdraw(uint256 amount) external {
        uint256 balance = depositsOf[msg.sender];
        require(amount > 0, "Withdraw amount must be > 0");
        require(amount <= balance, "Insufficient balance");

        uint256 yield = calculateYield(msg.sender);
        depositsOf[msg.sender] = balance - amount;
        totalDeposits -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal transfer failed");

        emit Withdrawn(msg.sender, amount, yield);
    }

    /// @notice Calculate yield earned by an address.
    function calculateYield(address account) public view returns (uint256) {
        uint256 balance = depositsOf[account];
        if (balance == 0) return 0;
        uint256 timeHeld = block.timestamp - lastDepositTime[account];
        return (balance * yieldRateBps * timeHeld) / (10000 * 365 days);
    }

    /// @notice Get current balance.
    function balanceOf(address account) external view returns (uint256) {
        return depositsOf[account];
    }

    /// @notice Get total vault deposits.
    function getTotalDeposits() external view returns (uint256) {
        return totalDeposits;
    }

    /// @notice Update yield rate (owner only).
    function setYieldRate(uint256 bps) external onlyOwner {
        require(bps <= 10000, "Rate too high");
        yieldRateBps = bps;
        emit YieldRateUpdated(bps);
    }

    receive() external payable {
        deposit();
    }
}
