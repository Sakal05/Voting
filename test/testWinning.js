const { expect } = require("chai");
const { assert } = require("chai");
const sinon = require("sinon"); //skip timeout

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

    for (let i = 0; i < addresses.length; i++) {
      await tokenContract.transfer(addresses[i].address, 200);
      await tokenContract.connect(addresses[i]).approve(contract.address, 200);
      await contract.connect(owner).delegate(addresses[i].address);
    }

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

  it("1. should create a new proposal", async function () {
    // Get the proposal at index 0
    const proposal1 = await contract.proposal(0);
    const proposal2 = await contract.proposal(1);
    const proposal3 = await contract.proposal(2);

    // Expect the proposal's title to match the title passed in
    expect(proposal1.title).to.equal("Test Proposal");
    console.log("This is proposal title 1: ", proposal1.title);
    expect(proposal2.title).to.equal("Test Second Proposal");
    expect(proposal3.title).to.equal("Test Third Proposal");
  });

  it("2. Should show the total of 3 proposals", async function () {
    const proposals = await contract.getAllProposals();
    const proposalLength = proposals.length;
    expect(proposalLength).to.equal(3);
  });

  it("3. Should allow a user to vote on a proposal", async function () {
    // Call the vote function and pass in the necessary arguments
    try {
      await contract.connect(addresses[0]).vote(1, 0, 100);
      await contract.connect(addresses[1]).vote(1, 0, 100);
      await contract.connect(addresses[2]).vote(1, 0, 100);
      await contract.connect(addresses[3]).vote(1, 0, 100);
      await contract.connect(addresses[4]).vote(1, 1, 100);
    } catch (e) {
      console.log("Error: ", e);
    }
    //await contract.connect(addr1).vote(0, 0, 100);

    const voterAfter = await contract.voters(addresses[0].address);
    console.log(`Voter Right After Vote: ${voterAfter.voteRight}`);
    //expect(await voterAfter.voteRight).to.equal(0);

    // Get the proposal at index 0
    // console.log("Proposal Owner Address: ", firstProposal.owner);
    
    try {
        await contract.connect(owner).declareWinningProposal(1);
    } catch (e) {
        console.log("Can't perform winning calculation, error: ");
    }
    const firstProposal = await contract.proposal(1);
    console.log("Proposal: ", firstProposal);
    // const secondProposal = await contract.proposal(1);

    // // console.log(`Proposal balance is: ${proposal.balance}`);
    // // Expect the proposal's approveCount to be 1 and rejectCount to be 0
    expect(firstProposal.approveCount).to.equal(4);
    expect(firstProposal.rejectCount).to.equal(1);
    expect(firstProposal.winningStatus).to.equal(true);
    // expect(firstProposal.balance).to.equal(100);

    // //expect the second proposal's approveCount to be 0 and rejectCount to be 1
    // expect(secondProposal.approveCount).to.equal(0);
    // expect(secondProposal.rejectCount).to.equal(1);
    // expect(secondProposal.balance).to.equal(0);
  });
});
