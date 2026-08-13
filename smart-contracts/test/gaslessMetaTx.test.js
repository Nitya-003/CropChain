const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Gasless Meta-Transactions (EIP-2771 / Relayers)", function () {
  let cropChain, forwarder;
  let owner, farmer, relayer, recipient;
  let FARMER_ROLE, DEFAULT_ADMIN_ROLE;

  beforeEach(async function () {
    [owner, farmer, relayer, recipient] = await ethers.getSigners();

    // 1. Deploy ERC2771 Forwarder
    const ForwarderFactory = await ethers.getContractFactory("CropChainForwarder");
    forwarder = await upgrades.deployProxy(ForwarderFactory, ["CropChainForwarder"], {
      initializer: "initialize",
    });
    await forwarder.waitForDeployment();
    const forwarderAddress = await forwarder.getAddress();

    // 2. Deploy CropChainUpgradeable with Trusted Forwarder
    const CropChainFactory = await ethers.getContractFactory("CropChainUpgradeable");
    cropChain = await upgrades.deployProxy(CropChainFactory, [], {
      kind: "uups",
      initializer: "initialize",
      constructorArgs: [forwarderAddress],
    });
    await cropChain.waitForDeployment();

    FARMER_ROLE = await cropChain.FARMER_ROLE();
    DEFAULT_ADMIN_ROLE = await cropChain.DEFAULT_ADMIN_ROLE();

    // Grant Farmer Role
    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);
  });

  describe("Trusted Forwarder Configuration", function () {
    it("should correctly configure the trusted forwarder address", async function () {
      const forwarderAddress = await forwarder.getAddress();
      expect(await cropChain.getTrustedForwarder()).to.equal(forwarderAddress);
      expect(await cropChain.isTrustedForwarder(forwarderAddress)).to.be.true;
    });

    it("should reject non-trusted forwarders", async function () {
      expect(await cropChain.isTrustedForwarder(relayer.address)).to.be.false;
    });
  });

  describe("EIP-2771 Meta-Transaction Execution", function () {
    it("should allow a farmer to create a batch via meta-transaction relayed by a sponsor (0 gas paid by farmer)", async function () {
      const cropChainAddress = await cropChain.getAddress();
      const forwarderAddress = await forwarder.getAddress();

      const batchId = ethers.id("BATCH-GASLESS-101");
      const cropTypeHash = ethers.id("ORGANIC_COTTON");
      const ipfsCID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

      // Encode function call for createBatch
      const data = cropChain.interface.encodeFunctionData("createBatch", [
        batchId,
        cropTypeHash,
        ipfsCID,
        1000,
        "Zero Gas Farm",
        "Gujarat",
        "Meta-Tx Harvest",
      ]);

      const nonce = await forwarder.nonces(farmer.address);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      // Construct ForwardRequest
      const req = {
        from: farmer.address,
        to: cropChainAddress,
        value: 0,
        gas: 500000n,
        nonce: nonce,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
        data: data,
      };

      // EIP-712 Typed Data Signing
      const domain = {
        name: "CropChainForwarder",
        version: "1",
        chainId: chainId,
        verifyingContract: forwarderAddress,
      };

      const types = {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint48" },
          { name: "data", type: "bytes" },
        ],
      };

      // Sign off-chain message (Farmer pays ZERO gas)
      const farmerInitialBalance = await ethers.provider.getBalance(farmer.address);
      const signature = await farmer.signTypedData(domain, types, req);

      // Relayer submits transaction on-chain (Relayer pays gas)
      const verifyResult = await forwarder.verify({
        from: req.from,
        to: req.to,
        value: req.value,
        gas: req.gas,
        deadline: req.deadline,
        data: req.data,
        signature: signature,
      });
      expect(verifyResult).to.be.true;

      await forwarder.connect(relayer).execute({
        from: req.from,
        to: req.to,
        value: req.value,
        gas: req.gas,
        deadline: req.deadline,
        data: req.data,
        signature: signature,
      });

      // Verify farmer balance remained unchanged (Zero gas used by farmer)
      const farmerFinalBalance = await ethers.provider.getBalance(farmer.address);
      expect(farmerFinalBalance).to.equal(farmerInitialBalance);

      // Verify batch created on-chain with farmer as creator!
      const batch = await cropChain.getBatch(batchId);
      expect(batch.exists).to.be.true;
      expect(batch.creator).to.equal(farmer.address);
      expect(batch.quantity).to.equal(1000);
    });
  });
});
