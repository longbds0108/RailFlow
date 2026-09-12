// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Railflow Collateral Vault
/// @notice Minimal, self-custodial collateral vault for the Railflow perp
/// demo on Arc Testnet. Arc's native currency is USDC (see the chain's
/// `nativeCurrency` config), so deposits and withdrawals move the chain's
/// native value directly — no ERC-20 approve/transferFrom is needed.
/// Every address can only ever deposit or withdraw its own collateral;
/// there is no owner, admin, or upgrade path that could touch anyone
/// else's balance.
contract RailflowVault {
    mapping(address => uint256) public collateralOf;

    event Deposited(address indexed account, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed account, uint256 amount, uint256 newBalance);

    /// @notice Deposit the attached native USDC value as trading collateral.
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be greater than zero");
        collateralOf[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, collateralOf[msg.sender]);
    }

    /// @notice Withdraw up to your own deposited collateral back to your wallet.
    function withdraw(uint256 amount) external {
        uint256 balance = collateralOf[msg.sender];
        require(amount > 0, "Withdraw amount must be greater than zero");
        require(amount <= balance, "Insufficient collateral balance");
        // Effects before interaction: balance is updated before the external
        // call below, so a malicious receive/fallback on msg.sender can't
        // re-enter withdraw() and drain more than its own balance.
        collateralOf[msg.sender] = balance - amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdraw transfer failed");
        emit Withdrawn(msg.sender, amount, collateralOf[msg.sender]);
    }

    receive() external payable {
        revert("Send USDC via deposit(), not a plain transfer");
    }
}
