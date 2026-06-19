// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RailFlowAMM
/// @notice Minimal constant-product (x*y=k) AMM used as the fallback swap venue
///         for RailFlow on Arc Testnet. Circle App Kit's swap is tried first by
///         the frontend; when Circle's testnet pool reverts at simulation
///         (documented as "unstable testnet liquidity"), the swap is routed here
///         instead so the demo always has a working on-chain swap.
///
/// @dev This is a REAL AMM, not a mock: swaps move tokens on-chain via the
///      constant-product formula with a 0.3% fee, identical maths to Uniswap V2.
///      Reserves are tracked per directed token pair. The owner seeds liquidity
///      with `addLiquidity`. All tokens here use 6 decimals (USDC/EURC); the pool
///      makes no value assumption — price is purely reserve-driven.
contract RailFlowAMM is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Swap fee in basis points (30 = 0.30%), kept by the pool.
    uint256 public constant FEE_BPS = 30;
    uint256 private constant BPS = 10_000;

    /// @notice reserves[tokenIn][tokenOut] = units of tokenIn held for the
    ///         (tokenIn, tokenOut) pool. A pool is the pair of both directions.
    mapping(address => mapping(address => uint256)) public reserves;

    event LiquidityAdded(address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB);
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor() Ownable(msg.sender) {}

    /// @notice Current reserves for the directed pair (tokenIn, tokenOut).
    function getReserves(address tokenIn, address tokenOut)
        public
        view
        returns (uint256 reserveIn, uint256 reserveOut)
    {
        reserveIn = reserves[tokenIn][tokenOut];
        reserveOut = reserves[tokenOut][tokenIn];
    }

    /// @notice Constant-product output for `amountIn` of `tokenIn`, net of fee.
    function getAmountOut(address tokenIn, address tokenOut, uint256 amountIn)
        public
        view
        returns (uint256)
    {
        (uint256 reserveIn, uint256 reserveOut) = getReserves(tokenIn, tokenOut);
        if (amountIn == 0 || reserveIn == 0 || reserveOut == 0) return 0;
        uint256 amountInWithFee = amountIn * (BPS - FEE_BPS);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * BPS + amountInWithFee;
        return numerator / denominator;
    }

    /// @notice Owner seeds (or tops up) liquidity for a pair. Pulls both tokens
    ///         from the caller; reserves grow by the deposited amounts.
    function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB)
        external
        onlyOwner
        nonReentrant
    {
        require(tokenA != tokenB && tokenA != address(0) && tokenB != address(0), "bad pair");
        require(amountA > 0 && amountB > 0, "zero amount");
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);
        reserves[tokenA][tokenB] += amountA;
        reserves[tokenB][tokenA] += amountB;
        emit LiquidityAdded(tokenA, tokenB, amountA, amountB);
    }

    /// @notice Swap `amountIn` of `tokenIn` for `tokenOut`, sending output to `to`.
    ///         Reverts if output < `minAmountOut` (slippage protection).
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) external nonReentrant returns (uint256 amountOut) {
        require(to != address(0), "bad recipient");
        require(amountIn > 0, "zero amountIn");
        amountOut = getAmountOut(tokenIn, tokenOut, amountIn);
        require(amountOut > 0, "no liquidity");
        require(amountOut >= minAmountOut, "slippage");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        reserves[tokenIn][tokenOut] += amountIn;
        reserves[tokenOut][tokenIn] -= amountOut;
        IERC20(tokenOut).safeTransfer(to, amountOut);

        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }
}
