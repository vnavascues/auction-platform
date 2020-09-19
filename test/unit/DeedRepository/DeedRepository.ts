import { ethers, upgrades } from "@nomiclabs/buidler";
import { Signer } from "ethers";
import { DeedRepository } from "../../../build/typechain/DeedRepository";
import { fallback } from "./DeedRepository.fallback";
import { initialize } from "./DeedRepository.initialize";
import { mintDeed } from "./DeedRepository.mintDeed";
import { payable } from "./DeedRepository.payable";
import { setDeedMetadata } from "./DeedRepository.setDeedMetadata";

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
    contract: DeedRepository;
    signers: Signer[];
    deployer: Signer;
  }
}

describe("DeedRepository", () => {
  const name = "Deed Repository";
  const symbol = "DEED";

  before(async function () {
    this.signers = await ethers.getSigners();
    this.deployer = this.signers[0];
    const factory = await ethers.getContractFactory(
      "DeedRepository",
      this.deployer,
    );
    this.contract = (await upgrades.deployProxy(factory, [
      name,
      symbol,
    ])) as DeedRepository;
    await this.contract.deployed;
  });

  describe("fallback()", () => fallback());
  describe("initialize()", () => initialize(name, symbol));
  describe("mintDeed()", () => mintDeed());
  describe("payable()", () => payable());
  describe("setDeedMetadata()", () => setDeedMetadata());
});
