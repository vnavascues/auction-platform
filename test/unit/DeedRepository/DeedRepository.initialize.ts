import chai from "chai";
const { expect } = chai;
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";

export function initialize(name: string, symbol: string): void {
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

  it("sets the name", async function () {
    expect(await this.contract.name()).to.equal(name);
  });

  it("sets the symbol", async function () {
    expect(await this.contract.symbol()).to.equal(symbol);
  });

  it("prevents to initialise the contract again", async function () {
    await expect(this.contract.initialize(name, symbol)).to.be.revertedWith(
      "Contract instance has already been initialized",
    );
  });
}
