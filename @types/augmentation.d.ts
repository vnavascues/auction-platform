export interface TypechainConfig {
  target: "ethers-v4" | "ethers-v5" | "truffle-v4" | "truffle-v5" | "web3-v1";
}

declare module "@nomiclabs/buidler/types" {
  interface BuidlerConfig {
    gasReporter: Any;
    typechain: TypechainConfig;
  }
  interface ProjectPaths {
    coverage: string;
    coverageJson: string;
    typechain: string;
  }
}
