const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Chainlink CCIP Cross-Chain Attestations", function () {
  let router, sender, receiver, nft;
  let admin, serviceWallet, farmer;

  const SOURCE_SELECTOR = 12532609583862916517n; // Polygon chain selector
  const DEST_SELECTOR = 16015286601757825753n; // Ethereum chain selector

  async function deployAndWait(factory, args = []) {
    const contract = await factory.deploy(...args);
    if (typeof contract.waitForDeployment === "function") {
      await contract.waitForDeployment();
    } else if (typeof contract.deployed === "function") {
      await contract.deployed();
    }
    return contract;
  }

  async function addressOf(contract) {
    if (typeof contract.getAddress === "function") {
      return await contract.getAddress();
    }
    return contract.address;
  }

  beforeEach(async function () {
    [admin, serviceWallet, farmer] = await ethers.getSigners();

    const Router = await ethers.getContractFactory("MockCCIPRouter");
    router = await deployAndWait(Router);

    const Sender = await ethers.getContractFactory("CropChainCCIPSender");
    sender = await deployAndWait(Sender, [await addressOf(router)]);

    const NFT = await ethers.getContractFactory("ProofOfDeliveryNFT");
    nft = await deployAndWait(NFT, ["CropChain Proof of Delivery", "CPOD"]);

    const Receiver = await ethers.getContractFactory("CropChainCCIPReceiver");
    receiver = await deployAndWait(Receiver, [await addressOf(router), await addressOf(nft)]);

    await sender.setDestination(DEST_SELECTOR, await addressOf(receiver));
    await receiver.setTrustedSource(SOURCE_SELECTOR, await addressOf(sender));

    const senderRole = await sender.CCIP_SENDER_ROLE();
    await sender.grantRole(senderRole, serviceWallet.address);

    await router.setFee(ethers.parseEther("0.01"));
  });

  describe("Cross-Chain Batch Provenance Verification", function () {
    it("should dispatch a cross-chain batch attestation payload via CCIP sender", async function () {
      await sender.fundPaymasterCredit(farmer.address, {
        value: ethers.parseEther("0.05"),
      });

      const payload = {
        batchId: ethers.id("BATCH-CCIP-ATTEST-001"),
        cropTypeHash: ethers.id("BASMATI_RICE"),
        ipfsCID: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
        quantity: 2500n,
        farmer: farmer.address,
        originLocation: "Karnal, Haryana",
        qualityGrade: 1, // Grade A+
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      };

      await expect(
        sender.connect(serviceWallet).syncBatchAttestation(payload)
      ).to.emit(sender, "BatchAttestationDispatched");

      expect(await sender.paymasterCredits(farmer.address)).to.equal(ethers.parseEther("0.04"));
    });

    it("should process and verify cross-chain batch attestation on CCIP receiver", async function () {
      await sender.fundPaymasterCredit(farmer.address, {
        value: ethers.parseEther("0.05"),
      });

      const payload = {
        batchId: ethers.id("BATCH-CCIP-ATTEST-002"),
        cropTypeHash: ethers.id("ORGANIC_WHEAT"),
        ipfsCID: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
        quantity: 1800n,
        farmer: farmer.address,
        originLocation: "Ludhiana, Punjab",
        qualityGrade: 2, // Grade A
        timestamp: BigInt(Math.floor(Date.now() / 1000)),
      };

      const tx = await sender.connect(serviceWallet).syncBatchAttestation(payload);
      const receipt = await tx.wait();

      const parsedLog = receipt.logs
        .map((log) => {
          try {
            return sender.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((item) => item && item.name === "BatchAttestationDispatched");

      const messageId = parsedLog.args.messageId;

      // Deliver message to receiver contract
      await router.deliverToReceiver(
        messageId,
        await addressOf(receiver),
        SOURCE_SELECTOR,
        await addressOf(sender)
      );

      // Verify destination cross-chain provenance record
      const record = await receiver.crossChainAttestations(payload.batchId);
      expect(record.verified).to.be.true;
      expect(record.batchId).to.equal(payload.batchId);
      expect(record.farmer).to.equal(farmer.address);
      expect(record.quantity).to.equal(1800n);
      expect(record.originLocation).to.equal("Ludhiana, Punjab");
      expect(record.qualityGrade).to.equal(2);
    });
  });
});
