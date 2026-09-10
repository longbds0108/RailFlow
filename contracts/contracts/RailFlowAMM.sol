// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RailFlowAMM
/// @notice Real constant-product swaps between USDC, EURC and cirBTC on Arc
/// Testnet. Each unordered token pair (USDC/EURC, USDC/cirBTC, EURC/cirBTC)
/// is its own isolated x*y=k market — no LP tokens, no public liquidity
/// provision; the owner seeds each pair once. A swap on one pair never
/// touches another pair's reserves.
/// @dev Testnet demo: liquidity depth is whatever the owner has seeded, so
/// getAmountOut returns 0 (and swap reverts) for a pair that hasn't been
/// funded yet — the frontend should show that honestly rather than a price.
contract RailFlowAMM is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_BPS = 30; // 0.30% swap fee, stays in the pool
    uint256 public constant BPS_DENOMINATOR = 10_000;

    mapping(address => mapping(address => uint256)) public reserves; // reserves[tokenIn][tokenOut]

    event LiquiditySeeded(address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB);
    event Swap(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    constructor(address _owner) Ownable(_owner) {}

    /// @notice Owner-funded liquidity for one pair. Can be called again to
    /// top a pair up; ratios don't need to match the existing reserves.
    function seedLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external onlyOwner {
        require(tokenA != tokenB, "same token");
        require(amountA > 0 && amountB > 0, "zero amount");
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        reserves[tokenA][tokenB] += amountA;
        reserves[tokenB][tokenA] += amountB;
        emit LiquiditySeeded(tokenA, tokenB, amountA, amountB);
    }

    /// @notice Constant-product quote, fee-inclusive. Returns 0 if the pair
    /// has no seeded liquidity rather than reverting, so the frontend can
    /// treat "no quote" as a normal state.
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn) public view returns (uint256) {
        uint256 reserveIn = reserves[tokenIn][tokenOut];
        uint256 reserveOut = reserves[tokenOut][tokenIn];
        if (reserveIn == 0 || reserveOut == 0 || amountIn == 0) return 0;
        uint256 amountInWithFee = amountIn * (BPS_DENOMINATOR - FEE_BPS);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * BPS_DENOMINATOR) + amountInWithFee;
        return numerator / denominator;
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        require(tokenIn != tokenOut, "same token");
        require(amountIn > 0, "amount=0");
        amountOut = getAmountOut(tokenIn, tokenOut, amountIn);
        require(amountOut > 0, "no liquidity for this pair");
        require(amountOut >= minAmountOut, "slippage");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        reserves[tokenIn][tokenOut] += amountIn;
        reserves[tokenOut][tokenIn] -= amountOut;
        IERC20(tokenOut).safeTransfer(to, amountOut);

        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function getReserves(address tokenA, address tokenB) external view returns (uint256 reserveA, uint256 reserveB) {
        return (reserves[tokenA][tokenB], reserves[tokenB][tokenA]);
    }
}
