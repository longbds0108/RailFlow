const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const USDC_DECIMALS = 6;
const APY_BPS = 1000n; // 10%
const LOCK_SECONDS = 0;
const MIN_STAKE = 1_000_000n; // 1 USDC (6 decimals)
const YEAR = 365n * 24n * 60n * 60n;
const BPS = 10_000n;

function usdc(n) {
  return BigInt(n) * 10n ** BigInt(USDC_DECIMALS);
}

describe("ArcStaking", function () {
  async function deployFixture() {
    const [owner, user] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdcToken = await MockERC20.deploy("USD Coin", "USDC", USDC_DECIMALS);
    const eurcToken = await MockERC20.deploy("Euro Coin", "EURC", USDC_DECIMALS);

    const ArcStaking = await ethers.getContractFactory("ArcStaking");
    const staking = await ArcStaking.deploy(
      await usdcToken.getAddress(),
      APY_BPS,
      LOCK_SECONDS,
      MIN_STAKE
    );

    await staking.setAllowedToken(await usdcToken.getAddress(), true);
    await staking.setAllowedToken(await eurcToken.getAddress(), true);

    // Fund the reward pool with 10 USDC from the owner.
    await usdcToken.mint(owner.address, usdc(10));
    await usdcToken.approve(await staking.getAddress(), usdc(10));
    await staking.fundRewardPool(usdc(10));

    return { owner, user, usdcToken, eurcToken, staking };
  }

  it("stakes EURC, accrues USDC reward over time, and claims it", async function () {
    const { user, usdcToken, eurcToken, staking } = await deployFixture();

    const principal = usdc(100); // 100 EURC staked
    await eurcToken.mint(user.address, principal);
    await eurcToken.connect(user).approve(await staking.getAddress(), principal);

    await staking.connect(user).stake(await eurcToken.getAddress(), principal);

    const info = await staking.stakeInfo(user.address, await eurcToken.getAddress());
    expect(info.principal).to.equal(principal);

    // Advance exactly one year.
    await time.increase(Number(YEAR));

    // Expected reward = principal * apyBps / 10000 * elapsed / year = 10% of 100 = 10 USDC.
    const expected = (principal * APY_BPS * YEAR) / (BPS * YEAR);
    const pending = await staking.pendingReward(user.address, await eurcToken.getAddress());
    // Allow a 1-second drift from the extra block mined on claim/checkpoint.
    expect(pending).to.be.closeTo(expected, principal * APY_BPS / (BPS * YEAR) * 2n + 1n);

    const before = await usdcToken.balanceOf(user.address);
    await staking.connect(user).claim(await eurcToken.getAddress());
    const after = await usdcToken.balanceOf(user.address);

    const paid = after - before;
    expect(paid).to.be.closeTo(expected, principal * APY_BPS / (BPS * YEAR) * 2n + 1n);

    // Reward debt reset after claim.
    const post = await staking.stakeInfo(user.address, await eurcToken.getAddress());
    expect(post.reward).to.equal(0n);
  });

  it("enforces minStake and rejects disallowed tokens", async function () {
    const { user, eurcToken, staking } = await deployFixture();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const random = await MockERC20.deploy("Random", "RND", 6);
    await random.mint(user.address, usdc(5));
    await random.connect(user).approve(await staking.getAddress(), usdc(5));
    await expect(
      staking.connect(user).stake(await random.getAddress(), usdc(5))
    ).to.be.revertedWithCustomError(staking, "TokenNotAllowed");

    await eurcToken.mint(user.address, usdc(1));
    await eurcToken.connect(user).approve(await staking.getAddress(), usdc(1));
    await expect(
      staking.connect(user).stake(await eurcToken.getAddress(), 500_000n)
    ).to.be.revertedWithCustomError(staking, "BelowMinStake");
  });

  it("lets the user unstake principal and emits events", async function () {
    const { user, eurcToken, staking } = await deployFixture();

    const principal = usdc(50);
    await eurcToken.mint(user.address, principal);
    await eurcToken.connect(user).approve(await staking.getAddress(), principal);

    await expect(staking.connect(user).stake(await eurcToken.getAddress(), principal))
      .to.emit(staking, "Staked")
      .withArgs(user.address, await eurcToken.getAddress(), principal);

    await expect(staking.connect(user).unstake(await eurcToken.getAddress(), principal))
      .to.emit(staking, "Unstaked")
      .withArgs(user.address, await eurcToken.getAddress(), principal);

    expect(await eurcToken.balanceOf(user.address)).to.equal(principal);
  });
});
