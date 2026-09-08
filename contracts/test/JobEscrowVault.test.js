const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const USDC_DECIMALS = 6;
const APY_BPS = 1000n; // 10%
const YEAR = 365n * 24n * 60n * 60n;
const BPS = 10_000n;

function usdc(n) {
  return ethers.parseUnits(String(n), USDC_DECIMALS);
}

describe("JobEscrowVault", function () {
  async function deployFixture() {
    const [owner, client, provider, evaluator, other] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdcToken = await MockERC20.deploy("USD Coin", "USDC", USDC_DECIMALS);

    const Vault = await ethers.getContractFactory("JobEscrowVault");
    const vault = await Vault.deploy(await usdcToken.getAddress(), APY_BPS);

    // Fund the demo reward pool from the owner.
    await usdcToken.mint(owner.address, usdc(1000));
    await usdcToken.approve(await vault.getAddress(), usdc(1000));
    await vault.fundRewardPool(usdc(1000));

    await usdcToken.mint(client.address, usdc(10_000));
    await usdcToken.connect(client).approve(await vault.getAddress(), usdc(10_000));
    await usdcToken.mint(provider.address, usdc(10_000));
    await usdcToken.connect(provider).approve(await vault.getAddress(), usdc(10_000));

    return { owner, client, provider, evaluator, other, usdcToken, vault };
  }

  async function currentTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return BigInt(block.timestamp);
  }

  it("full happy path with a required stake: 50/50 yield split, provider gets budget + stake back", async function () {
    const { client, provider, evaluator, usdcToken, vault } = await deployFixture();
    const budget = usdc(1000);
    const requiredStake = usdc(100);
    const expiredAt = (await currentTimestamp()) + 3600n;

    const tx = await vault
      .connect(client)
      .createJob(provider.address, evaluator.address, budget, requiredStake, expiredAt, "Design a logo");
    const receipt = await tx.wait();
    const jobId = receipt.logs
      .map((l) => { try { return vault.interface.parseLog(l); } catch { return null; } })
      .find((e) => e?.name === "JobCreated").args.jobId;

    let job = await vault.getJob(jobId);
    expect(job.status).to.equal(0n); // Open — stake not locked yet

    await vault.connect(provider).lockStake(jobId);
    job = await vault.getJob(jobId);
    expect(job.status).to.equal(1n); // Funded

    await vault.connect(provider).submit(jobId, ethers.keccak256(ethers.toUtf8Bytes("deliverable")));
    job = await vault.getJob(jobId);
    expect(job.status).to.equal(2n); // Submitted

    // Advance exactly one year so the expected yield is exact.
    await time.increase(Number(YEAR));

    const principal = budget + requiredStake;
    const expectedYield = (principal * APY_BPS * YEAR) / (BPS * YEAR);
    const half = expectedYield / 2n;

    const providerBefore = await usdcToken.balanceOf(provider.address);
    const clientBefore = await usdcToken.balanceOf(client.address);

    await vault.connect(evaluator).resolve(jobId, true);

    const providerAfter = await usdcToken.balanceOf(provider.address);
    const clientAfter = await usdcToken.balanceOf(client.address);

    // Allow small drift from the extra block mined for resolve().
    const tolerance = (principal * APY_BPS) / (BPS * YEAR) * 2n + 1n;
    expect(providerAfter - providerBefore).to.be.closeTo(principal + half, tolerance);
    expect(clientAfter - clientBefore).to.be.closeTo(expectedYield - half, tolerance);

    job = await vault.getJob(jobId);
    expect(job.status).to.equal(3n); // Completed
  });

  it("no stake required: job is Funded immediately at creation", async function () {
    const { client, provider, evaluator, vault } = await deployFixture();
    const expiredAt = (await currentTimestamp()) + 3600n;

    const tx = await vault
      .connect(client)
      .createJob(provider.address, evaluator.address, usdc(50), 0n, expiredAt, "No stake needed");
    const receipt = await tx.wait();
    const jobId = receipt.logs
      .map((l) => { try { return vault.interface.parseLog(l); } catch { return null; } })
      .find((e) => e?.name === "JobCreated").args.jobId;

    const job = await vault.getJob(jobId);
    expect(job.status).to.equal(1n); // Funded
    expect(job.activatedAt).to.not.equal(0n);
  });

  it("rejection: client gets budget + provider's stake back, no yield to provider", async function () {
    const { client, provider, evaluator, usdcToken, vault } = await deployFixture();
    const budget = usdc(1000);
    const requiredStake = usdc(100);
    const expiredAt = (await currentTimestamp()) + 3600n;

    const tx = await vault
      .connect(client)
      .createJob(provider.address, evaluator.address, budget, requiredStake, expiredAt, "desc");
    const receipt = await tx.wait();
    const jobId = receipt.logs
      .map((l) => { try { return vault.interface.parseLog(l); } catch { return null; } })
      .find((e) => e?.name === "JobCreated").args.jobId;

    await vault.connect(provider).lockStake(jobId);
    await vault.connect(provider).submit(jobId, ethers.keccak256(ethers.toUtf8Bytes("bad work")));

    await time.increase(3600); // some time passes, yield would have accrued if approved

    const clientBefore = await usdcToken.balanceOf(client.address);
    const providerBefore = await usdcToken.balanceOf(provider.address);

    await vault.connect(evaluator).resolve(jobId, false);

    const clientAfter = await usdcToken.balanceOf(client.address);
    const providerAfter = await usdcToken.balanceOf(provider.address);

    expect(clientAfter - clientBefore).to.equal(budget + requiredStake);
    expect(providerAfter).to.equal(providerBefore); // provider gets nothing back

    const job = await vault.getJob(jobId);
    expect(job.status).to.equal(4n); // Rejected
  });

  it("expiry while Open (stake never locked): client only gets the budget back", async function () {
    const { client, provider, evaluator, usdcToken, vault } = await deployFixture();
    const budget = usdc(200);
    const requiredStake = usdc(20);
    const expiredAt = (await currentTimestamp()) + 100n;

    const tx = await vault
      .connect(client)
      .createJob(provider.address, evaluator.address, budget, requiredStake, expiredAt, "desc");
    const receipt = await tx.wait();
    const jobId = receipt.logs
      .map((l) => { try { return vault.interface.parseLog(l); } catch { return null; } })
      .find((e) => e?.name === "JobCreated").args.jobId;

    await time.increase(200);

    const clientBefore = await usdcToken.balanceOf(client.address);
    await vault.expire(jobId); // permissionless
    const clientAfter = await usdcToken.balanceOf(client.address);

    expect(clientAfter - clientBefore).to.equal(budget); // stake was never collected
    const job = await vault.getJob(jobId);
    expect(job.status).to.equal(5n); // Expired
  });

  it("expiry while Funded (stake locked, never submitted/resolved): client gets budget + stake", async function () {
    const { client, provider, evaluator, other, usdcToken, vault } = await deployFixture();
    const budget = usdc(200);
    const requiredStake = usdc(20);
    const expiredAt = (await currentTimestamp()) + 100n;

    const tx = await vault
      .connect(client)
      .createJob(provider.address, evaluator.address, budget, requiredStake, expiredAt, "desc");
    const receipt = await tx.wait();
    const jobId = receipt.logs
      .map((l) => { try { return vault.interface.parseLog(l); } catch { return null; } })
      .find((e) => e?.name === "JobCreated").args.jobId;

    await vault.connect(provider).lockStake(jobId);
    await time.increase(200);

    const clientBefore = await usdcToken.balanceOf(client.address);
    await vault.connect(other).expire(jobId).catch(() => vault.expire(jobId)); // permissionless either way
    const clientAfter = await usdcToken.balanceOf(client.address);

    expect(clientAfter - clientBefore).to.equal(budget + requiredStake);
  });

  it("rejects expiring before the deadline and resolving twice", async function () {
    const { client, provider, evaluator, vault } = await deployFixture();
    const expiredAt = (await currentTimestamp()) + 3600n;
    const tx = await vault
      .connect(client)
      .createJob(provider.address, evaluator.address, usdc(10), 0n, expiredAt, "desc");
    const receipt = await tx.wait();
    const jobId = receipt.logs
      .map((l) => { try { return vault.interface.parseLog(l); } catch { return null; } })
      .find((e) => e?.name === "JobCreated").args.jobId;

    await expect(vault.expire(jobId)).to.be.revertedWithCustomError(vault, "NotExpiredYet");

    await vault.connect(provider).submit(jobId, ethers.keccak256(ethers.toUtf8Bytes("x")));
    await vault.connect(evaluator).resolve(jobId, true);
    await expect(vault.connect(evaluator).resolve(jobId, true)).to.be.revertedWithCustomError(vault, "WrongStatus");
  });

  it("enforces role checks: only client's chosen provider/evaluator can act", async function () {
    const { client, provider, evaluator, other, vault } = await deployFixture();
    const expiredAt = (await currentTimestamp()) + 3600n;
    const tx = await vault
      .connect(client)
      .createJob(provider.address, evaluator.address, usdc(10), usdc(5), expiredAt, "desc");
    const receipt = await tx.wait();
    const jobId = receipt.logs
      .map((l) => { try { return vault.interface.parseLog(l); } catch { return null; } })
      .find((e) => e?.name === "JobCreated").args.jobId;

    await expect(vault.connect(other).lockStake(jobId)).to.be.revertedWithCustomError(vault, "NotProvider");
    await vault.connect(provider).lockStake(jobId);
    await expect(vault.connect(other).submit(jobId, ethers.ZeroHash)).to.be.revertedWithCustomError(vault, "NotProvider");
    await vault.connect(provider).submit(jobId, ethers.ZeroHash);
    await expect(vault.connect(other).resolve(jobId, true)).to.be.revertedWithCustomError(vault, "NotEvaluator");
  });

  it("insufficient reward pool blocks approval instead of silently underpaying", async function () {
    const [owner, client, provider, evaluator] = await ethers.getSigners();
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdcToken = await MockERC20.deploy("USD Coin", "USDC", USDC_DECIMALS);
    const Vault = await ethers.getContractFactory("JobEscrowVault");
    const vault = await Vault.deploy(await usdcToken.getAddress(), APY_BPS);
    // No reward pool funded at all.

    await usdcToken.mint(client.address, usdc(100_000));
    await usdcToken.connect(client).approve(await vault.getAddress(), usdc(100_000));
    await usdcToken.mint(provider.address, usdc(100_000));
    await usdcToken.connect(provider).approve(await vault.getAddress(), usdc(100_000));

    const expiredAt = (await currentTimestamp()) + 3600n;
    const tx = await vault
      .connect(client)
      .createJob(provider.address, evaluator.address, usdc(50_000), usdc(5_000), expiredAt, "big job");
    const receipt = await tx.wait();
    const jobId = receipt.logs
      .map((l) => { try { return vault.interface.parseLog(l); } catch { return null; } })
      .find((e) => e?.name === "JobCreated").args.jobId;

    await vault.connect(provider).lockStake(jobId);
    await vault.connect(provider).submit(jobId, ethers.ZeroHash);
    await time.increase(Number(YEAR));

    await expect(vault.connect(evaluator).resolve(jobId, true)).to.be.revertedWithCustomError(
      vault,
      "InsufficientRewardPool"
    );
  });
});
