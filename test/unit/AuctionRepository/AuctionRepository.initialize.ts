import chai from "chai";
const { expect } = chai;
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";

export function initialize(): void {
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

  it("prevents to initialise the contract again", async function () {
    await expect(this.auctionRepository.initialize()).to.be.revertedWith(
      "Contract instance has already been initialized",
    );
  });
}
