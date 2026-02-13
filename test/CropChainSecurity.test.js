const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("CropChain Security Hardening", function () {
  async function deployFixture() {
    const [owner, farmer, mandi, attackerEOA] = await ethers.getSigners();
    const CropChain = await ethers.getContractFactory("CropChain");
    const cropChain = await CropChain.deploy();
    await cropChain.waitForDeployment();

    return { cropChain, owner, farmer, mandi, attackerEOA };
  }

  it("blocks reentrancy attempts against withdrawLiquidity", async function () {
    const { cropChain, attackerEOA } = await deployFixture();

    const attackerFactory = await ethers.getContractFactory("ReentrancyAttacker", attackerEOA);
    const attacker = await attackerFactory.deploy(await cropChain.getAddress());
    await attacker.waitForDeployment();

    const attackAmount = ethers.parseEther("1");
    await attacker.connect(attackerEOA).attack({ value: attackAmount });

    expect(await cropChain.mandiLiquidity(await attacker.getAddress())).to.equal(0n);
    expect(await attacker.reentrancyAttempted()).to.equal(true);
    expect(await ethers.provider.getBalance(await cropChain.getAddress())).to.equal(0n);
  });

  it("enforces circuit breaker on state-changing flows", async function () {
    const { cropChain, owner, farmer } = await deployFixture();

    await cropChain.connect(owner).setRole(farmer.address, 1);
    await cropChain.connect(owner).pause();

    const batchId = ethers.keccak256(ethers.toUtf8Bytes("batch-paused"));
    await expect(
      cropChain.connect(farmer).createBatch(batchId, "cid://abc", 100)
    ).to.be.revertedWith("Pausable: paused");

    await expect(
      cropChain.connect(farmer).depositLiquidity({ value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("Pausable: paused");
  });

  it("computes TWAP over configured observation window", async function () {
    const { cropChain, owner } = await deployFixture();

    const cropKey = ethers.keccak256(ethers.toUtf8Bytes("WHEAT"));
    await cropChain.connect(owner).setTWAPWindow(30 * 60);

    await cropChain.connect(owner).recordCropPrice(cropKey, 100);
    await time.increase(600);
    await cropChain.connect(owner).recordCropPrice(cropKey, 200);
    await time.increase(600);
    await cropChain.connect(owner).recordCropPrice(cropKey, 300);
    await time.increase(600);

    expect(await cropChain.getCropTWAP(cropKey)).to.equal(200);
  });

  it("maintains CEI withdrawal accounting", async function () {
    const { cropChain, mandi } = await deployFixture();

    const depositAmount = ethers.parseEther("0.5");
    await cropChain.connect(mandi).depositLiquidity({ value: depositAmount });
    expect(await cropChain.mandiLiquidity(mandi.address)).to.equal(depositAmount);

    await cropChain.connect(mandi).withdrawLiquidity(ethers.parseEther("0.2"));
    expect(await cropChain.mandiLiquidity(mandi.address)).to.equal(ethers.parseEther("0.3"));
  });
});
