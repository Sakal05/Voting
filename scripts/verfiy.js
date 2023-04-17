const { ethers } = require("hardhat");
require("@nomiclabs/hardhat-etherscan");
const fs = require('fs');


async function main() {
// Verify the contract after deploying
await hre.run("verify:verify", {
address: "0x6e3596d5739Df71eeD85d57AD9dc32E3d9cb9606",
constructorArguments: ["0x013D212b3787F4C511B83E3C1cF509B2Ff05E924"],
// for example, if your constructor argument took an address, do something like constructorArguments: ["0xABCDEF..."],
}).then((res) => {
    let verificationResult = JSON.stringify(res, null, 2);
    fs.appendFileSync('README.md', verificationResult + '\n', 'utf-8');
});
}
// Call the main function and catch if there is any error
main()
.then(() => process.exit(0))
.catch((error) => {
console.error(error);
process.exit(1);
});