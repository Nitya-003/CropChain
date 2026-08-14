const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("Mandi DAO Governance & Dispute Voting Test Suite", function () {
  let token, dao;
  let owner, delegate1, delegate2;

  beforeEach(async function () {
    [owner, delegate1, delegate2] = await ethers.getSigners();

    // Deploy MandiGovernanceToken
    const Token = await ethers.getContractFactory("MandiGovernanceToken");
    token = await upgrades.deployProxy(Token, [owner.address], {
      initializer: "initialize",
    });
    await token.waitForDeployment();

    // Deploy MandiDAO
    const DAO = await ethers.getContractFactory("MandiDAO");
    // votingDelay = 1 block, votingPeriod = 5 blocks, proposalThreshold = 0, quorum = 4%
    dao = await upgrades.deployProxy(
      DAO,
      [await token.getAddress(), 1, 5, 0, 4],
      { initializer: "initialize" }
    );
    await dao.waitForDeployment();
  });

  it("should mint governance tokens and delegate voting power", async function () {
    const ownerAddress = owner.address;
    await token.delegate(ownerAddress);

    const votes = await token.getVotes(ownerAddress);
    expect(votes).to.equal(ethers.parseEther("1000000"));
  });

  it("should create a dispute proposal and cast votes", async function () {
    await token.delegate(owner.address);

    const targets = [delegate1.address];
    const values = [0];
    const calldatas = ["0x"];
    const description = "Proposal #1: Mandi Dispute Resolution Escrow Payout";

    // Propose
    const tx = await dao.propose(targets, values, calldatas, description);
    const receipt = await tx.wait();
    
    // Get proposalId from ProposalCreated event
    const proposalId = await dao.hashProposal(
      targets,
      values,
      calldatas,
      ethers.keccak256(ethers.toUtf8Bytes(description))
    );

    expect(proposalId).to.be.ok;

    // Fast-forward 1 block for voting delay
    await ethers.provider.send("evm_mine", []);

    // Cast Vote (1 = For)
    await dao.castVote(proposalId, 1);

    const state = await dao.state(proposalId);
    // State 1 = Active
    expect(state).to.equal(1);
  });
});
