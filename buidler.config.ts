import dotenv from "dotenv";
import variableExpansion from "dotenv-expand";
variableExpansion(dotenv.config());

import { BuidlerConfig, usePlugin } from "@nomiclabs/buidler/config";
import "./tasks";

usePlugin("@nomiclabs/buidler-ethers");
usePlugin("@nomiclabs/buidler-ganache");
usePlugin("@nomiclabs/buidler-solhint");
usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@openzeppelin/buidler-upgrades");
usePlugin("buidler-gas-reporter");
usePlugin("solidity-coverage");

const config: BuidlerConfig = {
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? !!Number(process.env.REPORT_GAS) : false,
  },
  networks: {
    coverage: {
      url: "http://127.0.0.1:8555",
    },
  },
  paths: {
    artifacts: "./build/artifacts",
    coverage: "./coverage",
    coverageJson: "./coverage.json",
    typechain: "./build/typechain",
  },
  solc: {
    optimizer: {
      enabled: false,
      runs: 200,
    },
    version: "0.6.12",
  },
  typechain: {
    target: "ethers-v5",
  },
};

export default config;
