const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CropChain Security Refactor", function () {
  async function deployFixture() {
    const [owner, farmer, mandi, transporter, retailer, attackerController] = await ethers.getSigners();

    const CropChain = await ethers.getContractFactory("CropChain");
    const cropChain = await CropChain.deploy();
    await cropChain.waitForDeployment();

    return { cropChain, owner, farmer, mandi, transporter, retailer, attackerController };
  }

  it("preserves core batch lifecycle and enforces stage-role checks", async function () {
    const { cropChain, owner, farmer, mandi, transporter, retailer } = await deployFixture();

    await cropChain.connect(owner).setRole(farmer.address, 1); // Farmer
    await cropChain.connect(owner).setRole(mandi.address, 2); // Mandi
    await cropChain.connect(owner).setRole(transporter.address, 3); // Transporter
    await cropChain.connect(owner).setRole(retailer.address, 4); // Retailer

    const batchId = "CROP-2026-001";
    const batchHash = ethers.keccak256(ethers.toUtf8Bytes(batchId));

    await cropChain.connect(farmer).createBatch(
      batchId,
      "Ramesh",
      "Village Rampur",
      "Wheat",
      500,
      "2026-02-10",
      "UP, India",
      "Organic",
      "QmMockCID123"
    );

    await cropChain.connect(mandi).updateBatch(batchHash, 1, "Mandi APMC", "Lucknow", "Received and graded");
    await cropChain.connect(transporter).updateBatch(batchHash, 2, "Truck-42", "NH-27", "In transit");
    await cropChain.connect(retailer).updateBatch(batchHash, 3, "Retail Hub", "Kanpur", "Stocked");

    const updates = await cropChain.getBatchUpdates(batchHash);
    expect(updates.length).to.equal(4);

    await expect(
      cropChain.connect(mandi).updateBatch(batchHash, 3, "Bad Actor", "X", "Invalid transition")
    ).to.be.reverted;
  });

  it("supports circuit breaker pause/unpause for external state-changing functions", async function () {
    const { cropChain, owner, farmer } = await deployFixture();

    await cropChain.connect(owner).setRole(farmer.address, 1);

    await cropChain.connect(owner).setPaused(true);

    await expect(
      cropChain.connect(farmer).createBatch(
        "CROP-2026-002",
        "Sita",
        "Village A",
        "Rice",
        100,
        "2026-02-11",
        "Bihar",
        "FPO",
        "QmCID"
      )
    ).to.be.revertedWith("Pausable: paused");

    await cropChain.connect(owner).setPaused(false);

    await cropChain.connect(farmer).createBatch(
      "CROP-2026-002",
      "Sita",
      "Village A",
      "Rice",
      100,
      "2026-02-11",
      "Bihar",
      "FPO",
      "QmCID"
    );

    expect(await cropChain.getBatchCount()).to.equal(1);
  });

  it("blocks mock reentrancy attack on liquidity withdrawals", async function () {
    const { cropChain, owner, attackerController } = await deployFixture();

    const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
    const attacker = await Attacker.connect(attackerController).deploy(await cropChain.getAddress());
    await attacker.waitForDeployment();

    await cropChain.connect(owner).setRole(await attacker.getAddress(), 2); // Mandi role for attacker contract

    await attacker.connect(attackerController).depositToTarget({ value: ethers.parseEther("1.0") });

    const initialLiquidity = await cropChain.mandiLiquidity(await attacker.getAddress());
    expect(initialLiquidity).to.equal(ethers.parseEther("1.0"));

    await attacker.connect(attackerController).initiateAttack(
      ethers.parseEther("0.2"),
      3
    );

    const finalLiquidity = await cropChain.mandiLiquidity(await attacker.getAddress());

    expect(await attacker.reentryCount()).to.be.greaterThan(0n);
    expect(await attacker.reentryBlocked()).to.equal(true);
    expect(finalLiquidity).to.equal(ethers.parseEther("0.8"));
    expect(await cropChain.totalLiquidity()).to.equal(ethers.parseEther("0.8"));
  });

  it("calculates TWAP from spot price observations", async function () {
    const { cropChain, owner, mandi } = await deployFixture();

    await cropChain.connect(owner).setRole(mandi.address, 2);

    await cropChain.connect(mandi).submitSpotPrice("Wheat", 100);
    await ethers.provider.send("evm_increaseTime", [60]);
    await ethers.provider.send("evm_mine", []);

    await cropChain.connect(mandi).submitSpotPrice("Wheat", 200);
    await ethers.provider.send("evm_increaseTime", [60]);
    await ethers.provider.send("evm_mine", []);

    const twap = await cropChain.getTwapPrice("Wheat", 120);

    expect(twap).to.be.greaterThan(100);
    expect(twap).to.be.lessThan(200);
  });
});
