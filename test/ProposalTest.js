const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { TASK_COMPILE_SOLIDITY_COMPILE } = require("hardhat/builtin-tasks/task-names");

describe("Contract", function () {
  let contract;
  let tokenContract, proposalContract, voteContract;
  let owner;
  let ad1, ad2, ad3, ad4, ad5, ad6, ad7;
  let addresses;
  let decimal;
  let DECIMAL;

  before(async function () {
    [owner, ad1, ad2, ad3, ad4, ad5, ad6, ad7] = await ethers.getSigners();
    addresses = [ad1, ad2, ad3, ad4, ad5, ad6, ad7];

    const TokenContract = await ethers.getContractFactory("Flexy");
    const token = await TokenContract.deploy();
    tokenContract = await token.deployed();
    decimal = 10**(await tokenContract.decimals());
    DECIMAL = BigInt(decimal);

    const ProposalContract = await ethers.getContractFactory("ProposalContract");
    const proposal = await ProposalContract.deploy();
    proposalContract = await proposal.deployed();

    console.log("Proposal Address", proposalContract.address);
  });

  it("tests", async function(){
    console.log("Proposal Address", proposalContract.address);
  });
  
});
