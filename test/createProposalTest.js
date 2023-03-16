const { expect } = require("chai");
const { ethers } = require("ethers");
const hre = require("hardhat");


describe("Voting", function() {
  let voting;
  let token;

  beforeEach(async function() {
    // Deploy the FlexyToken contract
    //const tokenFactory = await ethers.getContractFactory("FlexyToken");
    //const TokenContract = await hre.ethers.getContractFactory("Flexy");
   
    // Deploy the Voting contract, passing in the address of the token contract
    const Contract = await hre.ethers.getContractFactory("Voting");
    voting = await Contract.attach(
        "0x5FbDB2315678afecb367f032d93F642f64180aa3" // The deployed contract address
      );

  });

  it("should create a new proposal", async function() {
    // Call the createProposal function
    await voting.createProposal("My Proposal", "This is my proposal", "https://example.com/whitepaper");

    // Retrieve the proposal from the proposals array
    const proposal = await voting.proposals(0);

    // Check that the proposal was created correctly
    expect(proposal.owner).to.equal("0X12131322341234");
    expect(proposal.title).to.equal("My Proposal");
    expect(proposal.description).to.equal("This is my proposal");
    expect(proposal.whitePaper).to.equal("https://example.com/whitepaper");
  });

  // Add more test cases here...
});
