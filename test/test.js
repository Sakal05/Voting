const { expect } = require("chai");
const { assert } = require("chai");
// const { time, expectRevert } = require("@openzeppelin/test-helpers"); // <-- add this line
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// const sinon = require("sinon"); //skip timeout

describe("Voting Contract", function () {
  let contract;
  let tokenContract;
  let owner, addr1, addr2, addr3, addr4, addr5;
  let ad1, ad2, ad3, ad4, ad5, ad6, ad7;
  let addresses = [ad1, ad2, ad3, ad4, ad5, ad6, ad7];
  let voting;

  beforeEach(async function () {
    // Deploy a new instance of the FlexyToken contract
    const TokenContract = await ethers.getContractFactory("Flexy");
    const token = await TokenContract.deploy();
    tokenContract = await token.deployed();

    //[owner] = await ethers.getSigners();
    [owner, addr1, addr2, addr3, addr4, addr5] = await ethers.getSigners();
    addresses = await ethers.getSigners();
    // Deploy a new instance of the Voting contract, passing in the address of the FlexyToken contract
    const VotingContract = await ethers.getContractFactory("Voting");
    voting = await VotingContract.deploy(token.address);
    contract = await voting.deployed();

    await contract
      .connect(owner)
      .createProposal(
        "Test Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf"
      );

    await contract
      .connect(owner)
      .createProposal(
        "Test Second Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf"
      );

    await contract
      .connect(owner)
      .createProposal(
        "Test Third Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf"
      );
  });

  //use descript.only to run specific tests and skipping all other tests
  describe("Create Proposal", function () {
    it("should create a new proposal", async function () {
      // Get the proposal at index 0
      const proposal1 = await contract.proposals(0);
      const proposal2 = await contract.proposals(1);
      const proposal3 = await contract.proposals(2);

      // Expect the proposal's title to match the title passed in
      expect(proposal1.title).to.equal("Test Proposal");
      console.log("This is proposal title 1: ", proposal1.title);
      expect(proposal2.title).to.equal("Test Second Proposal");
      expect(proposal3.title).to.equal("Test Third Proposal");
    });

    it("Should emit the right event", async function () {
      const createProposalEvent = await contract
        .connect(owner)
        .createProposal(
          "Test Event Proposal",
          "This is a test Event proposal.",
          "https://example.com/test.pdf"
        );
      await expect(createProposalEvent)
        .to.emit(contract, "ProposalEvent")
        .withArgs(
          3,
          owner.address,
          "Test Event Proposal",
          "This is a test Event proposal."
        );
    });

    it("Should show the total of 3 proposals", async function () {
      const proposals = await contract.getAllProposals();
      const proposalLength = proposals.length;
      expect(proposalLength).to.equal(3);
    });
  });

  describe("Vote on Proposal", function () {
    let voterR;

    beforeEach(async function () {
      for (let i = 0; i < addresses.length; i++) {
        await tokenContract.transfer(addresses[i].address, 200);
        await tokenContract
          .connect(addresses[i])
          .approve(contract.address, 200);
        await contract.connect(owner).delegate(addresses[i].address);
        await contract.connect(owner).delegate(addresses[i].address);
      }

      voterR = await contract.voters(addr1.address);
    });

    // afterEach(async function () {
    //   clock.restore();
    // });

    it("Should show voting right is equal to 2", async function () {
      // Transfer some tokens to the user's account
      // console.log(`Voter Right Before Vote: ${voterR.voteRight}`);
      expect(await voterR.voteRight).to.equal(2);
    });

    it("Should allow a voter to vote on a proposal", async function () {
      // Call the vote function and pass in the necessary arguments
      const firstVote = await contract.connect(addr1).vote(0, 0, 100);
      const secondVote = await contract.connect(addr1).vote(1, 1, 100);
      //await firstVote.await();

      await expect(firstVote)
        .to.emit(contract, "VoteEvent")
        .withArgs(0, addr1.address, "Approve", "Vote successful");
      await expect(secondVote)
        .to.emit(contract, "VoteEvent")
        .withArgs(1, addr1.address, "Reject", "Vote successful");

      const voterAfter = await contract.voters(addr1.address);

      // const voterProp = await contract.getVoterProposals();
      expect(await voterAfter.voteRight).to.equal(0);
      // expect(await voterAfter.proposalId[1]).to.equal(1);
      // console.log(`Voter proposal After Vote: ${voterProp}`);

      // Get the proposal at index 0
      const firstProposal = await contract.proposal(0);
      //await contract.declareWinningProposal(0);
      const secondProposal = await contract.proposal(1);

      // console.log(`1st Proposal Approve Count: ${firstProposal.approveCount}`);
      // console.log(`1st Proposal rejected Count: ${firstProposal.rejectCount}`);
      // console.log(`2nd Proposal Approve Count: ${secondProposal.approveCount}`);
      // console.log(`2nd Proposal rejected Count: ${secondProposal.rejectCount}`);

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
      expect(contractBalance).to.equal(100);
      // console.log(`Contract balance: ${contractBalance}`);
    });

    it("Shoud NOT allow user to vote on the same proposal twice", async function () {
      await contract.connect(addr1).vote(0, 0, 100);

      await expect(contract.connect(addr1).vote(0, 0, 100)).to.revertedWith(
        "You have already voted for this proposal"
      );
    });

    it("Should NOT allow user to vote if insufficient token", async function () {
      await contract.connect(addr1).vote(0, 0, 100);
      await contract.connect(addr1).vote(1, 0, 100);

      await expect(contract.connect(addr1).vote(2, 0, 100)).to.revertedWith(
        "Insufficient balance"
      );
    });

    // it("Shouldn't allow user to vote when deadline is reached", async function () {
    //   // await clock.tickAsync(400 * 1000);
    //   await assert.isRejected(
    //     contract.connect(addr1).vote(0, 0, 100),
    //     "Can't Vote, proposal had reached deadline"
    //   );

    //   // // Fast-forward time by 400 seconds and then call failTest function
    //   // await new Promise((resolve) => {
    //   //   setTimeout(resolve, 400 * 1000);
    //   // }).then(failTest);
    // });
  });

  describe("Winning Proposal", function () {
    beforeEach(async function () {
      for (let i = 0; i < addresses.length; i++) {
        await tokenContract.transfer(addresses[i].address, 200);
        await tokenContract
          .connect(addresses[i])
          .approve(contract.address, 200);

        await contract.connect(owner).delegate(addresses[i].address);
        await contract.connect(owner).delegate(addresses[i].address);
      }
      //second proposal voting
      await contract.connect(addr1).vote(1, 0, 100);
      await contract.connect(addr2).vote(1, 0, 100);
      await contract.connect(addr3).vote(1, 0, 100);
      await contract.connect(addr4).vote(1, 0, 100);
      await contract.connect(addr5).vote(1, 1, 100);
      //first proposal voting
      await contract.connect(addr1).vote(0, 0, 100);
      await contract.connect(addr2).vote(0, 0, 100);
      await contract.connect(addr3).vote(0, 1, 100);
      await contract.connect(addr4).vote(0, 1, 100);
      await contract.connect(addr5).vote(0, 1, 100);
    });

    it("Should give second proposal a Approve Win", async function () {
      await time.increase(435000);
      const declareWinProposal = await contract
        .connect(owner)
        .declareWinningProposal(1);
      const secondProposal = await contract.proposal(1);

      console.log(`Winning Status: ${secondProposal.winningStatus}`);
      expect(await secondProposal.winningStatus).to.equal(true);

      await expect(declareWinProposal)
        .to.emit(contract, "WinningProposalEvent")
        .withArgs(1, true, "Proposal settled successfully");

      expect(await secondProposal.totalVote).to.equal(5);
    });

    it("Should give Reject to First Proposal", async function () {
      await time.increase(435000);

      const declareWinProposal = await contract
        .connect(owner)
        .declareWinningProposal(0);
      const firstProposal = await contract.proposal(0);
      console.log(`Winning Status: ${firstProposal.winningStatus}`);
      expect(await firstProposal.winningStatus).to.equal(false);

      await expect(declareWinProposal)
        .to.emit(contract, "WinningProposalEvent")
        .withArgs(0, false, "Proposal settled successfully");

      expect(await firstProposal.totalVote).to.equal(5);
    });

    it("Should fail test as Proposal hasn't reach deadline yet", async function () {
      await time.increase(3600);
      await expect(
        contract.connect(owner).declareWinningProposal(1)
      ).to.revertedWith("Deadline Reach!");
    });
  });
});
