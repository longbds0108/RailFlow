// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Railflow T-Bill (ERC-20 Treasury Bill Token)
/// @notice ERC-20 token representing Treasury Bills with yield on Arc Testnet.
/// Simple implementation for testing and integration.
contract RailflowTBill {
    string public constant name = "Railflow T-Bill";
    string public constant symbol = "rTBILL";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public yieldOf;
    mapping(address => uint256) public lastClaimTime;

    address public owner;
    uint256 public yieldRateBps = 500; // 5% APY in basis points

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);
    event YieldClaimed(address indexed account, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /// @notice Mint new T-Bill tokens.
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        balanceOf[to] += amount;
        totalSupply += amount;
        lastClaimTime[to] = block.timestamp;
        emit Mint(to, amount);
        emit Transfer(address(0), to, amount);
    }

    /// @notice Burn T-Bill tokens.
    function burn(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Burn(msg.sender, amount);
        emit Transfer(msg.sender, address(0), amount);
    }

    /// @notice Calculate accumulated yield for an address.
    function calculateYield(address account) public view returns (uint256) {
        uint256 balance = balanceOf[account];
        if (balance == 0) return 0;
        uint256 timeHeld = block.timestamp - lastClaimTime[account];
        return (balance * yieldRateBps * timeHeld) / (10000 * 365 days);
    }

    /// @notice Claim accumulated yield.
    function claimYield() external {
        uint256 yield = calculateYield(msg.sender);
        require(yield > 0, "No yield to claim");
        yieldOf[msg.sender] += yield;
        lastClaimTime[msg.sender] = block.timestamp;
        emit YieldClaimed(msg.sender, yield);
    }

    /// @notice Transfer tokens.
    function transfer(address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Invalid address");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /// @notice TransferFrom tokens.
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(to != address(0), "Invalid address");
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        emit Transfer(from, to, amount);
        return true;
    }

    /// @notice Approve tokens for spending.
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /// @notice Update yield rate (owner only).
    function setYieldRate(uint256 bps) external onlyOwner {
        require(bps <= 10000, "Rate too high");
        yieldRateBps = bps;
    }
}
