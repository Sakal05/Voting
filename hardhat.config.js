require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-network-helpers");
require('dotenv').config();
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.10",
  networks: {
    mumbai: {
      url: process.env.REACT_APP_TESTNET_RPC,
      accounts: [process.env.REACT_APP_PRIVATE_KEY]
    },
  },
  etherscan: {
    apiKey: process.env.REACT_APP_POLYGONSCAN_API_KEY
  }
};
