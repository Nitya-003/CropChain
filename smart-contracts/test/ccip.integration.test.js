const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CCIP Cross-Chain Settlement", function () {
  let router;
  let sender;
  let receiver;
  let nft;

  let admin;
  let serviceWallet;
  let farmer;

  const SOURCE_SELECTOR = 12532609583862916517n; // Polygon-like selector for tests
  const DEST_SELECTOR = 16015286601757825753n; // Ethereum-like selector for tests

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

    const minterRole = await nft.MINTER_ROLE();
    await nft.grantRole(minterRole, await addressOf(receiver));

    const senderRole = await sender.CCIP_SENDER_ROLE();
    await sender.grantRole(senderRole, serviceWallet.address);

    await router.setFee(ethers.parseEther("0.01"));
  });

  it("dispatches retailer proof using paymaster credit and debits the farmer", async function () {
    await sender.fundPaymasterCredit(farmer.address, { value: ethers.parseEther("0.05") });

    const payload = {
      batchId: ethers.id("CROP-2026-0001"),
      actorName: "Retailer A",
      location: "Mumbai",
      deliveredAt: BigInt(Math.floor(Date.now() / 1000)),
      notes: "Delivered and accepted",
      farmer: farmer.address,
      quantity: 500n,
      ipfsCID: "ipfs://bafy-test"
    };

    await expect(sender.connect(serviceWallet).syncRetailerProof(payload))
      .to.emit(sender, "RetailerProofDispatched");

    expect(await sender.paymasterCredits(farmer.address)).to.equal(ethers.parseEther("0.04"));
  });

  it("mints proof NFT on destination chain when the receiver consumes a CCIP message", async function () {
    await sender.fundPaymasterCredit(farmer.address, { value: ethers.parseEther("0.05") });

    const payload = {
      batchId: ethers.id("CROP-2026-0002"),
      actorName: "Retailer B",
      location: "Pune",
      deliveredAt: BigInt(Math.floor(Date.now() / 1000)),
      notes: "Shelf ready",
      farmer: farmer.address,
      quantity: 1200n,
      ipfsCID: "ipfs://bafy-proof-0002"
    };

    const tx = await sender.connect(serviceWallet).syncRetailerProof(payload);
    const receipt = await tx.wait();

    const parsedLog = receipt.logs
      .map((log) => {
        try {
          return sender.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((item) => item && item.name === "RetailerProofDispatched");

    const messageId = parsedLog.args.messageId;

    await router.deliverToReceiver(
      messageId,
      await addressOf(receiver),
      SOURCE_SELECTOR,
      await addressOf(sender)
    );

    const tokenId = await nft.batchToTokenId(payload.batchId);
    expect(tokenId).to.equal(1n);
    expect(await nft.ownerOf(tokenId)).to.equal(farmer.address);
  });
});
