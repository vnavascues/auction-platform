import { Signer } from "ethers";
import chai from "chai";
const { expect } = chai;
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";

export function setDeedMetadata(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  const deedId = "12345";
  const metadata = "token metadata";
  let minter: Signer;

  before(async function () {
    snapshotOgId = await takeSnapshot();

    minter = this.signers[1];
    await this.contract.connect(minter).mintDeed(deedId, metadata);
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

  it("reverts if the sender is not the deed owner", async function () {
    const notMinter = this.signers[2];

    await expect(
      this.contract.connect(notMinter).setDeedMetadata(deedId, metadata),
    ).to.be.revertedWith("Only deed owner");
  });

  it("updates the metadata", async function () {
    const newMetadata = "new token metadata";

    await this.contract.connect(minter).setDeedMetadata(deedId, newMetadata);

    const tokenURI = await this.contract.tokenURI(deedId);
    expect(tokenURI).to.equal(newMetadata);
  });

  it("clears the metadata", async function () {
    const newMetadata = "";

    await this.contract.connect(minter).setDeedMetadata(deedId, newMetadata);

    const tokenURI = await this.contract.tokenURI(deedId);
    expect(tokenURI).to.equal(newMetadata);
  });

  it("emits the LogSetDeedMetadata event", async function () {
    const newMetadata = "new token metadata";
    const minterAddr = await minter.getAddress();

    await expect(
      this.contract.connect(minter).setDeedMetadata(deedId, newMetadata),
    )
      .to.emit(this.contract, "LogSetDeedMetadata")
      .withArgs(minterAddr, deedId);
  });
}
