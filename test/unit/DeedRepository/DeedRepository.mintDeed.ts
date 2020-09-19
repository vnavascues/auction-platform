import chai from "chai";
const { expect } = chai;
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";

export function mintDeed(): void {
  let snapshotOgId: string;
  let snapshotLocId: string;

  const deedId = "12345";
  const metadata = "token metadata";

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

  it("mints the token", async function () {
    const minter = this.signers[1];
    const minterAddr = await minter.getAddress();

    await this.contract.connect(minter).mintDeed(deedId, metadata);

    const ownerAddr = await this.contract.ownerOf(deedId);
    expect(ownerAddr).to.equal(minterAddr);
  });

  it("reverts if the token already exists", async function () {
    const minter = this.signers[1];

    await this.contract.connect(minter).mintDeed(deedId, metadata);

    await expect(
      this.contract.connect(minter).mintDeed(deedId, metadata),
    ).to.be.revertedWith("ERC721: token already minted");
  });

  it("sets the metadata", async function () {
    const minter = this.signers[1];

    await this.contract.connect(minter).mintDeed(deedId, metadata);

    const tokenURI = await this.contract.tokenURI(deedId);
    expect(tokenURI).to.equal(metadata);
  });

  it("emits the LogMintedDeed event", async function () {
    const minter = this.signers[1];
    const minterAddr = await minter.getAddress();

    await expect(this.contract.connect(minter).mintDeed(deedId, metadata))
      .to.emit(this.contract, "LogMintedDeed")
      .withArgs(minterAddr, deedId);
  });
}
