// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Railflow Agent
/// @notice AI agent contract for handling transactions and interactions on Arc Testnet.
/// This is a stub for testing deployment and integration.
contract RailflowAgent {
    address public owner;
    mapping(bytes32 => bool) public processedRequests;

    event RequestProcessed(bytes32 indexed requestId, address indexed requester, string action);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    /// @notice Process an agent request.
    function processRequest(
        bytes32 requestId,
        string calldata action,
        bytes calldata data
    ) external returns (bool success) {
        require(!processedRequests[requestId], "Request already processed");
        require(bytes(action).length > 0, "Action cannot be empty");

        processedRequests[requestId] = true;
        emit RequestProcessed(requestId, msg.sender, action);
        return true;
    }

    /// @notice Check if a request has been processed.
    function isProcessed(bytes32 requestId) external view returns (bool) {
        return processedRequests[requestId];
    }

    /// @notice Transfer ownership to a new address.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
