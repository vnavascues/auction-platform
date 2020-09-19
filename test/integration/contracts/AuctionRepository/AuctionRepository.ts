import { ethers, upgrades } from "@nomiclabs/buidler";
import { Signer } from "ethers";
import { AuctionRepository } from "../../../../build/typechain/AuctionRepository";
import { DeployOptions } from "@openzeppelin/buidler-upgrades/src/deploy-proxy";
import { withdrawFundsReentrancy } from "./AuctionRepository.withdrawFunds";

/**
 * !! Tests could be less bloated if:
 *   * Buidler-waffle had support for the following chain matchers:
 *     * calledOnContract
 *     * calledOnContractWith
 *
 * !! Tests could be faster if:
 *   * There was a better snapshots management for both buidlerevm and ganache-cli EVMs.
 *   * When nested contexts that require a new snapshot on top are used, it is complicated
 *   * to do not pollute the previous snapshots
 *     - https://github.com/nomiclabs/buidler/issues/659
 *     - https://github.com/trufflesuite/ganache-cli
 *
 *  Tests also could benefit from using a fixture API (but snapshot problems would persist).
 *   !! Currently Waffle `loadFixture` does not work for buidler-waffle,
 *   !! but it can be bypassed with `createFixtureLoader`
 *   TODO: alternatively explore buidler-deploy fixtures
 */
declare module "mocha" {
  export interface Context {
    auctionRepository: AuctionRepository;
    signers: Signer[];
    deployer: Signer;
  }
}

describe("AuctionRepository", () => {
  before(async function () {
    this.signers = await ethers.getSigners();
    this.deployer = this.signers[0];

    // Deploy AuctionRepository
    const factory = await ethers.getContractFactory(
      "AuctionRepository",
      this.deployer,
    );
    const opts: DeployOptions = {
      unsafeAllowCustomTypes: true,
    };
    this.auctionRepository = (await upgrades.deployProxy(
      factory,
      [],
      opts,
    )) as AuctionRepository;
    await this.auctionRepository.deployed;
  });

  describe("withdrawFundsReentrancy()", () => withdrawFundsReentrancy());
});
