const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// const sinon = require("sinon"); //skip timeout

describe("Voting Contract", function () {
  let contract;
  let tokenContract;
  let owner;
  let ad1, ad2, ad3, ad4, ad5, ad6, ad7;
  let addresses;
  let voting;

  beforeEach(async function () {
    // Deploy a new instance of the FlexyToken contract
    const TokenContract = await ethers.getContractFactory("Flexy");
    const token = await TokenContract.deploy();
    tokenContract = await token.deployed();

    [owner, ad1, ad2, ad3, ad4, ad5, ad6, ad7] = await ethers.getSigners();
    addresses = [ad1, ad2, ad3, ad4, ad5, ad6, ad7];

    //[ad1, ad2, ad3, ad4, ad5, ad6, ad7] = await ethers.getSigners();

    // Deploy a new instance of the Voting contract, passing in the address of the FlexyToken contract
    const VotingContract = await ethers.getContractFactory("Voting");
    voting = await VotingContract.deploy(token.address);
    contract = await voting.deployed();

    await contract
      .connect(owner)
      .createProposal(
        "Test Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf",
        10
      );

    await contract
      .connect(owner)
      .createProposal(
        "Test Second Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf",
        5
      );

    await contract
      .connect(owner)
      .createProposal(
        "Test Third Proposal",
        "This is a test proposal.",
        "https://example.com/test.pdf",
        5
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
      expect(await proposal1.proposalInfo.title).to.equal("Test Proposal");
      expect(await proposal1.proposalInfo.incentivePercentagePerMonth).to.equal(
        10
      ); //)
      expect(await proposal2.proposalInfo.title).to.equal(
        "Test Second Proposal"
      );
      expect(await proposal3.proposalInfo.title).to.equal(
        "Test Third Proposal"
      );
    });

    it("Should emit the right event", async function () {
      const createProposalEvent = await contract
        .connect(owner)
        .createProposal(
          "Test Event Proposal",
          "This is a test Event proposal.",
          "https://example.com/test.pdf",
          10
        );
      await expect(createProposalEvent)
        .to.emit(contract, "ProposalEvent")
        .withArgs(
          3,
          owner.address,
          "Test Event Proposal",
          "This is a test Event proposal.",
          10
        );
    });

    it("Should show the total of 3 proposals", async function () {
      const proposals = await contract.getAllProposals();
      const proposalLength = proposals.length;
      expect(proposalLength).to.equal(3);
    });

    it("Should get info of the first proposal", async function () {
      const firstProposal = await contract.getProposal(0);
      const firstTitle = await firstProposal.proposalInfo.title;
      const firstProposalIncentive = await firstProposal.proposalInfo
        .incentivePercentagePerMonth;
      expect(firstProposalIncentive).to.equal(10);
      expect(firstTitle).to.equal("Test Proposal");
    });
  });

  describe("Vote on Proposal", function () {

    beforeEach(async function () {
      for (let i = 0; i < addresses.length; i++) {
        await tokenContract.transfer(addresses[i].address, 200);
        await tokenContract
          .connect(addresses[i])
          .approve(contract.address, 200);
        await contract.connect(addresses[i]).delegate(addresses[i].address);
        await contract.connect(addresses[i]).delegate(addresses[i].address);
      }
    });

    it("Should show voting right is equal to 2", async function () {
      const voterR = await contract.voters(addresses[0].address);
      // console.log(`Voter Right Before Vote: ${voterR.voteRight}`);
      expect(await voterR.voteRight).to.equal(2);
    });

    it("Should allow a voter to vote on a proposal", async function () {
      // Call the vote function and pass in the necessary arguments
      const firstVote = await contract.connect(addresses[0]).vote(0, 0, 100);
      const secondVote = await contract.connect(addresses[0]).vote(1, 1, 100);
      //await firstVote.await();

      await expect(firstVote)
        .to.emit(contract, "VoteEvent")
        .withArgs(0, addresses[0].address, "Approve", "Vote successful");
      await expect(secondVote)
        .to.emit(contract, "VoteEvent")
        .withArgs(1, addresses[0].address, "Reject", "Vote successful");

      const voterAfter = await contract.voters(addresses[0].address);

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

    it("Should show the right number of proposals that voter has voted", async function () {
      await contract.connect(addresses[0]).vote(0, 0, 100);
      await contract.connect(addresses[0]).vote(1, 0, 100);
      const votingProposals = await contract
        .connect(addresses[0])
        .getVotedProposals();

      const votingProposalLength = votingProposals.length;
      expect(votingProposalLength).to.equal(2);
    });

    it("Shoud NOT allow user to vote on the same proposal twice", async function () {
      await contract.connect(addresses[0]).vote(0, 0, 100);

      await expect(
        contract.connect(addresses[0]).vote(0, 0, 100)
      ).to.revertedWith("You have already voted for this proposal");
    });

    it("Should NOT allow user to vote if insufficient token", async function () {
      await contract.connect(addresses[0]).vote(0, 0, 100);
      await contract.connect(addresses[0]).vote(1, 0, 100);

      await expect(
        contract.connect(addresses[0]).vote(2, 0, 100)
      ).to.revertedWith("Insufficient balance");
    });

    it("Should NOT allow to vote as proposal has reached deadline", async function () {
      await time.increase(435000);
      await expect(
        contract.connect(addresses[0]).vote(0, 0, 100)
      ).to.revertedWith("Can't Vote, proposal had reached deadline");
    });
  });

  describe("Winning Proposal", function () {
    beforeEach(async function () {
      for (let i = 0; i < addresses.length; i++) {
        await tokenContract.transfer(addresses[i].address, 500);
        await tokenContract
          .connect(addresses[i])
          .approve(contract.address, 500);

        await contract.delegate(addresses[i].address);
        await contract.delegate(addresses[i].address);
      }

      //second proposal voting
      await contract.connect(addresses[0]).vote(1, 0, 100);
      await contract.connect(addresses[1]).vote(1, 0, 100);
      await contract.connect(addresses[2]).vote(1, 0, 100);
      await contract.connect(addresses[3]).vote(1, 0, 100);
      await contract.connect(addresses[4]).vote(1, 1, 100);
      //first proposal voting
      await contract.connect(addresses[0]).vote(0, 0, 100);
      await contract.connect(addresses[1]).vote(0, 0, 100);
      await contract.connect(addresses[2]).vote(0, 1, 100);
      await contract.connect(addresses[3]).vote(0, 1, 100);
      await contract.connect(addresses[4]).vote(0, 1, 100);
    });

    it("Should give second proposal a Approve Win", async function () {
      await time.increase(435000);
      const declareWinProposal = await contract
        .connect(owner)
        .declareWinningProposal(1);
      const secondProposal = await contract.proposal(1);

      expect(await secondProposal.winningStatus).to.equal(true);

      await expect(declareWinProposal)
        .to.emit(contract, "WinningProposalEvent")
        .withArgs(1, true, "Proposal settled successfully");

      expect(await secondProposal.totalVote).to.equal(5);
      const initialOwnerBalance = await tokenContract.balanceOf(owner.address);

      const total = initialOwnerBalance + parseFloat(secondProposal.balance);
    });

    it("Should give Reject to First Proposal, transfer token back to voters who vote APPROVE", async function () {
      await time.increase(435000);

      const declareWinProposal = await contract
        .connect(owner)
        .declareWinningProposal(0);
      const firstProposal = await contract.proposal(0);

      expect(await firstProposal.winningStatus).to.equal(false);
      // expect(await tokenContract.balanceOf(owner.address)).to.equal(total);
      

      expect(await firstProposal.totalVote).to.equal(5);
    });

    it("Should fail test as Proposal hasn't reach deadline yet", async function () {
      await time.increase(3600);
      await expect(
        contract.connect(owner).declareWinningProposal(1)
      ).to.revertedWith("Proposal hasn't reached the deadline");
    });
  });

  describe("Incentive Distribution", function () {
    beforeEach(async function () {
      for (let i = 0; i < addresses.length; i++) {
        await tokenContract.transfer(addresses[i].address, 500);
        await tokenContract
          .connect(addresses[i])
          .approve(contract.address, 500);

        await contract.delegate(addresses[i].address);
        await contract.delegate(addresses[i].address);
      }
      //second proposal voting
      await contract.connect(addresses[0]).vote(1, 0, 100);
      await contract.connect(addresses[1]).vote(1, 0, 200);
      await contract.connect(addresses[2]).vote(1, 0, 100);
      await contract.connect(addresses[3]).vote(1, 0, 100);
      await contract.connect(addresses[4]).vote(1, 1, 100);
      //first proposal voting
      await contract.connect(addresses[0]).vote(0, 0, 100);
      await contract.connect(addresses[1]).vote(0, 0, 100);
      await contract.connect(addresses[2]).vote(0, 1, 100);
      await contract.connect(addresses[3]).vote(0, 1, 100);
      await contract.connect(addresses[4]).vote(0, 1, 100);
    });

    it("Should claim first incentive after 30 days", async function () {
      await time.increase(86400 * 35);
      await contract.declareWinningProposal(1);
      //const votingState = await contract.votingState(0);
      //console.log("Porposal: ", await contract.proposal(0));
      const claimFirstIncentive = await contract
        .connect(addresses[1])
        .claimVotingIncentive(1);

      const secondProposal = await contract.proposal(1);

      // expect(votingClaimCount).to.equal(1);
      const firstProposalIncentive =
        secondProposal.proposalInfo.incentivePercentagePerMonth;
      const voteBalance = await contract.getVoteBalanceByProposalId(1);
      const firstAddressVoteBalance = voteBalance[1];
      const incentive =
        (firstProposalIncentive * firstAddressVoteBalance) / 100;

      const voterBalanceAfter = await tokenContract.balanceOf(
        addresses[1].address
      );
      expect(voterBalanceAfter).to.equal(200 + incentive);

      await expect(claimFirstIncentive)
        .to.emit(contract, "claimIncentiveEvent")
        .withArgs(addresses[1].address, incentive);
    });

    it("Should claim second incentive after 2 months", async function () {
      await time.increase(86400 * 65);
      await contract.declareWinningProposal(1);

      await contract.connect(addresses[1]).claimVotingIncentive(1);

      await contract.connect(addresses[1]).claimVotingIncentive(1);

      const totalClaim = await contract
        .connect(addresses[1])
        .getClaimCounterByProposalId(1);

      expect(totalClaim[1]).to.equal(2);
    });

    it("Should NOT ALLOW to claim second incentive as Deadline Has Not Reached", async function () {
      await time.increase(86400 * 60);
      await contract.declareWinningProposal(1);

      await contract.connect(addresses[1]).claimVotingIncentive(1);

      await expect(
        contract.connect(addresses[1]).claimVotingIncentive(1)
      ).to.revertedWith("Claim Period hasn't reached deadline yet!");
    });

    it("Should NOT provide incentive as Proposal has been rejected", async function () {
      await time.increase(86400 * 35);
      await contract.declareWinningProposal(0);

      await expect(
        contract.connect(addresses[1]).claimVotingIncentive(0)
      ).to.revertedWith("Proposal has been rejected!");
    });

    it("Should Fail as voter voted reject", async function(){
      await time.increase(86400 * 35);
      await contract.declareWinningProposal(1);
      await expect(contract.connect(addresses[4]).claimVotingIncentive(1)).to.revertedWith("Voter must vote approve on the proposal");
    });

    it("Should fail test as voter doesn't exist", async function(){
      await time.increase(86400 * 35);
      await contract.declareWinningProposal(1);
      await expect(contract.connect(addresses[5]).claimVotingIncentive(1)).to.revertedWith("You are not a valid voter for this proposal");
    });
  });

  describe("Test Voting State", function () {
    beforeEach(async function () {
      for (let i = 0; i < addresses.length; i++) {
        await tokenContract.transfer(addresses[i].address, 500);
        await tokenContract
          .connect(addresses[i])
          .approve(contract.address, 500);

        await contract.delegate(addresses[i].address);
        await contract.delegate(addresses[i].address);
      }
      //second proposal voting
      await contract.connect(addresses[0]).vote(1, 0, 100);
      await contract.connect(addresses[1]).vote(1, 0, 200);
      await contract.connect(addresses[2]).vote(1, 0, 100);
      await contract.connect(addresses[3]).vote(1, 0, 100);
      await contract.connect(addresses[4]).vote(1, 1, 100);
      //first proposal voting
      await contract.connect(addresses[0]).vote(0, 0, 100);
      await contract.connect(addresses[1]).vote(0, 0, 100);
      await contract.connect(addresses[2]).vote(0, 1, 100);
      await contract.connect(addresses[3]).vote(0, 1, 100);
      await contract.connect(addresses[4]).vote(0, 1, 100);
    });

    it("should show right voting state of second proposal", async function () {
      //const secondProposal = await contract.proposal(1);
      await time.increase(86400 * 35);
      await contract.declareWinningProposal(1);
      await contract.connect(addresses[1]).claimVotingIncentive(1);
      const getVotedProposals = await contract
        .connect(addresses[0])
        .getVotedProposals();

      const voteString = getVotedProposals.toString();
      expect(voteString).to.equal("1,0");

      const votingStateVoters = await contract.getVotersByProposalId(1);
      const firstVoter = votingStateVoters[0];
      expect(firstVoter).to.equal(addresses[0].address);

      const votingClaimCount = await contract.getClaimCounterByProposalId(1);
      const votingClaimCountToString = await votingClaimCount.toString();
      expect(votingClaimCountToString).to.equal("0,1,0,0,0");
    });

    it("All getter functions", async function () {
      const claimProposal = await contract.getVoteBalanceByProposalId(1);
      expect(claimProposal.length).to.equal(5);
      const getVoteBalances = await contract.getVoteBalanceByProposalId(1);
      expect(getVoteBalances[1]).to.equal(200);
    });
    //it("show right event emit", function () {});
  });

});
