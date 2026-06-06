const { expect } = require("chai");
const { ethers } = require("hardhat");

const Roles = {
  None: 0,
  Farmer: 1,
  Mandi: 2,
  Transporter: 3,
  Retailer: 4,
  Oracle: 5,
  Admin: 6,
};

const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;

describe("CropChain Security Refactor", function () {
  async function deployFixture() {
    const [owner, buyer, oracle] = await ethers.getSigners();

    const CropChain = await ethers.getContractFactory("CropChain");
    const cropChain = await CropChain.deploy();
    await cropChain.waitForDeployment();

    return { cropChain, owner, buyer, oracle };
  }

  it("blocks mock reentrancy on withdrawProceeds", async function () {
    const { cropChain, owner, buyer, oracle } = await deployFixture();

    const cropType = ethers.keccak256(ethers.toUtf8Bytes("WHEAT"));
    const batchId = ethers.keccak256(ethers.toUtf8Bytes("BATCH-001"));
    const unitPrice = ethers.parseEther("1");

    await cropChain.setRole(oracle.address, Roles.Oracle);
    await cropChain.connect(oracle).recordSpotPrice(cropType, unitPrice);

    const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
    const attacker = await Attacker.deploy(await cropChain.getAddress());
    await attacker.waitForDeployment();

    await cropChain.setRole(await attacker.getAddress(), Roles.Farmer);

    await attacker.createBatchAndListing(batchId, cropType, 100, 20, unitPrice);

    await cropChain.connect(buyer).buyFromListing(1, 5, {
      value: ethers.parseEther("5"),
    });

    expect(
      await cropChain.pendingWithdrawals(await attacker.getAddress())
    ).to.equal(ethers.parseEther("5"));

    const balanceBefore = await ethers.provider.getBalance(
      await attacker.getAddress()
    );

    await attacker.attackWithdraw();

    const balanceAfter = await ethers.provider.getBalance(
      await attacker.getAddress()
    );

    expect(
      await cropChain.pendingWithdrawals(await attacker.getAddress())
    ).to.equal(0n);
    expect(await attacker.reentryAttempts()).to.equal(1n);
    expect(await attacker.reentrancySucceeded()).to.equal(false);
    expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("5"));
  });

  it("queues buyer overpayments for withdrawal instead of refunding inline", async function () {
    const { cropChain, owner, buyer, oracle } = await deployFixture();

    const cropType = ethers.keccak256(ethers.toUtf8Bytes("BARLEY"));
    const batchId = ethers.keccak256(ethers.toUtf8Bytes("BATCH-004"));
    const unitPrice = ethers.parseEther("1");

    await cropChain.setRole(oracle.address, Roles.Oracle);
    await cropChain.connect(oracle).recordSpotPrice(cropType, unitPrice);
    await cropChain.setRole(oracle.address, Roles.Farmer);

    await cropChain.connect(oracle).createBatch(
      batchId,
      cropType,
      "ipfs://bafybeigdyrztqz4xq7x4z7m4xq7x4z7m4xq7x4z7m4",
      50,
      "farmer",
      "origin",
      "notes"
    );

    await cropChain.connect(oracle).createListing(batchId, 10, unitPrice);

    await cropChain.connect(owner).buyFromListing(1, 1, {
      value: ethers.parseEther("2"),
    });

    expect(await cropChain.pendingWithdrawals(owner.address)).to.equal(
      ethers.parseEther("1")
    );

    await cropChain.connect(owner).withdrawProceeds();

    expect(await cropChain.pendingWithdrawals(owner.address)).to.equal(0n);
  });

  it("enforces circuit breaker on marketplace buy", async function () {
    const { cropChain, owner, buyer, oracle } = await deployFixture();

    const cropType = ethers.keccak256(ethers.toUtf8Bytes("RICE"));
    const batchId = ethers.keccak256(ethers.toUtf8Bytes("BATCH-002"));
    const unitPrice = ethers.parseEther("1");

    await cropChain.setRole(oracle.address, Roles.Oracle);
    await cropChain.connect(oracle).recordSpotPrice(cropType, unitPrice);
    await cropChain.setRole(oracle.address, Roles.Farmer);

    await cropChain.connect(oracle).createBatch(
      batchId,
      cropType,
      "ipfs://bafybeigdyrztqz4xq7x4z7m4xq7x4z7m4xq7x4z7m4",
      50,
      "farmer",
      "origin",
      "notes"
    );

    await cropChain.connect(oracle).createListing(batchId, 10, unitPrice);
    await cropChain.pause();

    await expect(
      cropChain.connect(buyer).buyFromListing(1, 1, { value: unitPrice })
    ).to.be.revertedWith("Pausable: paused");
  });

  it("uses TWAP to reject manipulated listing prices", async function () {
    const { cropChain, oracle } = await deployFixture();

    const cropType = ethers.keccak256(ethers.toUtf8Bytes("MAIZE"));
    const batchId = ethers.keccak256(ethers.toUtf8Bytes("BATCH-003"));

    await cropChain.setRole(oracle.address, Roles.Oracle);

    await cropChain.connect(oracle).recordSpotPrice(cropType, ethers.parseEther("1"));
    await ethers.provider.send("evm_increaseTime", [1800]);
    await ethers.provider.send("evm_mine", []);
    await cropChain.connect(oracle).recordSpotPrice(cropType, ethers.parseEther("1"));
    await cropChain.setRole(oracle.address, Roles.Farmer);

    await cropChain.connect(oracle).createBatch(
      batchId,
      cropType,
      "ipfs://bafybeigdyrztqz4xq7x4z7m4xq7x4z7m4xq7x4z7m4",
      100,
      "farmer",
      "field",
      "created"
    );

    await expect(
      cropChain.connect(oracle).createListing(batchId, 10, ethers.parseEther("5"))
    ).not.to.be.reverted;

    await expect(
      cropChain.buyFromListing(1, 1, { value: ethers.parseEther("5") })
    ).to.be.revertedWith("TWAP deviation too high");
  });

  it("restricts circuit breaker and TWAP tuning to the admin role", async function () {
    const { cropChain, buyer } = await deployFixture();

    await expect(cropChain.connect(buyer).pause()).to.be.revertedWith(
      "AccessControl: account " +
        buyer.address.toLowerCase() +
        " is missing role " +
        DEFAULT_ADMIN_ROLE
    );

    await expect(
      cropChain.connect(buyer).setTwapConfig(3600, 1000)
    ).to.be.revertedWith(
      "AccessControl: account " +
        buyer.address.toLowerCase() +
        " is missing role " +
        DEFAULT_ADMIN_ROLE
    );

    await expect(cropChain.pause()).to.not.be.reverted;
    expect(await cropChain.paused()).to.be.true;

    await expect(cropChain.setTwapConfig(7200, 1000))
      .to.not.be.reverted;
    expect(await cropChain.twapWindow()).to.equal(7200n);
    expect(await cropChain.maxPriceDeviationBps()).to.equal(1000n);
  });

  it("enforces custody validation on listing creation", async function () {
    const { cropChain, oracle } = await deployFixture();
    const [, , , mandi] = await ethers.getSigners();

    const cropType = ethers.keccak256(ethers.toUtf8Bytes("WHEAT"));
    const batchId = ethers.keccak256(ethers.toUtf8Bytes("BATCH-005"));
    const unitPrice = ethers.parseEther("1");

    await cropChain.setRole(oracle.address, Roles.Farmer);
    await cropChain.setRole(mandi.address, Roles.Mandi);

    // 1. Farmer creates the batch (stage = Farmer)
    await cropChain.connect(oracle).createBatch(
      batchId,
      cropType,
      "ipfs://bafybeigdyrztqz4xq7x4z7m4xq7x4z7m4xq7x4z7m4",
      50,
      "farmer",
      "origin",
      "notes"
    );

    // 2. Mandi updates the batch (stage = Mandi)
    await cropChain.connect(mandi).updateBatch(
      batchId,
      1, // Stage.Mandi
      "mandi-actor",
      "mandi-location",
      "received at mandi"
    );

    // 3. Farmer (oracle) tries to list/sell the batch -> should revert
    await expect(
      cropChain.connect(oracle).createListing(batchId, 10, unitPrice)
    ).to.be.revertedWith("Only current custodian can list");

    // 4. Mandi successfully lists the batch
    await expect(
      cropChain.connect(mandi).createListing(batchId, 10, unitPrice)
    ).to.not.be.reverted;
  });
});
