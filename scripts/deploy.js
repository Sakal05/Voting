const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with  the account: " + deployer.address);

  // Deploy First
  const Flexy = await ethers.getContractFactory("Flexy");
  const flexy = await Flexy.deploy();

  // Deploy Second
  const VotingContract = await ethers.getContractFactory("Voting");
  const votingContract = await VotingContract.deploy(flexy.address);

  fs.appendFileSync('README.md',`Token Address: ${flexy.address} \nVoting Contract: ${votingContract.address}`, 'utf-8');


  console.log("Token Contract: " + flexy.address);
  console.log("Voting Contract: " + votingContract.address);
}

main()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
