import { utils } from "ethers";
import chai from "chai";
const { expect } = chai;
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";

export function payable(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  before(async function () {
    snapshotOgId = await takeSnapshot();
  });

  beforeEach(async function () {
    snapshotLocId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotLocId);
  });

  after(async function () {
    await revertToSnapshot(snapshotOgId);
  });

  it("reverts, there is no receive function", async function () {
    const tx = {
      to: this.auctionRepository.address,
      value: utils.parseEther("1.0"),
    };
    await expect(this.deployer.sendTransaction(tx)).to.be.reverted;
  });
}
