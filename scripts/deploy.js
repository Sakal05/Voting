// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {

  const VotingContract = await hre.ethers.getContractFactory("Voting");
  const votingContract = await VotingContract.deploy("0x95C3CD97cF1d78fc4Dc954384FEB5B0Dce2a7DF7");

  await votingContract.deployed();

  console.log(
    `Contract deployed to Address ${votingContract.address}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
