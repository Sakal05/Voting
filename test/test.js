const { expect } = require("chai");
const { assert } = require("chai");

describe("Voting", function () {
  let contract;
  let tokenContract;
  let owner, addr1, addr2;
  let voting;

  beforeEach(async function () {
    // Deploy a new instance of the FlexyToken contract
    const TokenContract = await ethers.getContractFactory("Flexy");
    const token = await TokenContract.deploy();
    tokenContract = await token.deployed();

    //[owner] = await ethers.getSigners();
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy a new instance of the Voting contract, passing in the address of the FlexyToken contract
    const VotingContract = await ethers.getContractFactory("Voting");
    voting = await VotingContract.deploy(token.address);
    contract = await voting.deployed();
  });

  describe("Create Proposal", function () {
    it("should create a new proposal", async function () {
      // Call the createProposal function and pass in the necessary arguments
      await contract.createProposal(
        "Test Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf"
      );

      await contract.createProposal(
        "Test Second Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf"
      );

      await contract.createProposal(
        "Test Third Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf"
      );

      // Get the proposal at index 0
      const proposal1 = await contract.proposals(0);
      const proposal2 = await contract.proposals(1);

      // Expect the proposal's title to match the title passed in
      expect(proposal1.title).to.equal("Test Proposal");
      expect(proposal2.title).to.equal("Test Second Proposal");
    });
  });

  describe("Vote", function () {
    let voterR;
    beforeEach(async function () {
      await tokenContract.transfer(addr1.address, 200);

      // Approve the voting contract to spend the transferred tokens
      await tokenContract.connect(addr1).approve(contract.address, 200);

      // Delegate voteRight to addr1
      await contract.connect(owner).delegate(addr1.address);
      await contract.connect(owner).delegate(addr1.address);

      voterR = await contract.voters(addr1.address);
    });

    it("Should show show voting right equal to 2", async function () {
      // Transfer some tokens to the user's account
      console.log(`Voter Right Before Vote: ${voterR.voteRight}`);
      expect(await voterR.voteRight).to.equal(2);
    });

    it("Should allow a user to vote on a proposal", async function () {
      // Call the vote function and pass in the necessary arguments
      await contract.connect(addr1).vote(0, 0, 100);
      await contract.connect(addr1).vote(1, 1, 100);

      const voterAfter = await contract.voters(addr1.address);
      console.log(`Voter Right After Vote: ${voterAfter.voteRight}`);

      expect(await voterAfter.voteRight).to.equal(0);

      // Get the proposal at index 0
      const firstProposal = await contract.proposal(0);
      const secondProposal = await contract.proposal(1);

      console.log(`1st Proposal Approve Count: ${firstProposal.approveCount}`);
      console.log(`1st Proposal rejected Count: ${firstProposal.rejectCount}`);
      console.log(`2nd Proposal Approve Count: ${secondProposal.approveCount}`);
      console.log(`2nd Proposal rejected Count: ${secondProposal.rejectCount}`);

      // console.log(`Proposal balance is: ${proposal.balance}`);
      // Expect the proposal's approveCount to be 1 and rejectCount to be 0
      expect(firstProposal.approveCount).to.equal(1);
      expect(firstProposal.rejectCount).to.equal(0);
      expect(firstProposal.balance).to.equal(100);

      //expect the second proposal's approveCount to be 0 and rejectCount to be 1
      expect(secondProposal.approveCount).to.equal(0);
      expect(secondProposal.rejectCount).to.equal(1);
      expect(secondProposal.balance).to.equal(0);

      //check contract balance
      const contractBalance = await tokenContract.balanceOf(voting.address);
      console.log(`Contract balance: ${contractBalance}`);
    });

    it("Shoudn't allow user to vote on the same proposal twice", async function () {
      await contract.connect(addr1).vote(0, 0, 100);

      await assert.isRejected(
        contract.connect(addr1).vote(0, 0, 100),
        "You have already voted for this proposal"
      );
    });

    it("Shouldn't allow user to vote if insufficient token", async function () {
      await contract.connect(addr1).vote(0, 0, 100);
      await contract.connect(addr1).vote(1, 0, 100);

      await assert.isRejected(
        contract.connect(addr1).vote(2, 0, 100),
        "Insufficient balance"
      );
    });
  });
});
