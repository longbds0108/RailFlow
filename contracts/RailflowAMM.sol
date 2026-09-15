// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Railflow Automated Market Maker
/// @notice Minimal AMM contract for token swaps on Arc Testnet.
/// This is a stub for testing deployment and integration.
contract RailflowAMM {
    mapping(address => mapping(address => uint256)) public reserves;

    event LiquidityAdded(address indexed token0, address indexed token1, uint256 amount0, uint256 amount1);
    event Swapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    /// @notice Add liquidity to a token pair.
    function addLiquidity(
        address token0,
        address token1,
        uint256 amount0,
        uint256 amount1
    ) external {
        require(amount0 > 0 && amount1 > 0, "Amounts must be greater than zero");
        reserves[token0][token1] += amount0;
        reserves[token1][token0] += amount1;
        emit LiquidityAdded(token0, token1, amount0, amount1);
    }

    /// @notice Swap tokens using the AMM.
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        require(amountIn > 0, "Amount must be greater than zero");
        require(reserves[tokenIn][tokenOut] > 0, "No liquidity available");

        // Stub: simple 1:1 swap
        amountOut = amountIn;
        emit Swapped(tokenIn, tokenOut, amountIn, amountOut);
        return amountOut;
    }

    /// @notice Get reserves for a token pair.
    function getReserves(address token0, address token1)
        external
        view
        returns (uint256 reserve0, uint256 reserve1)
    {
        reserve0 = reserves[token0][token1];
        reserve1 = reserves[token1][token0];
    }
}
