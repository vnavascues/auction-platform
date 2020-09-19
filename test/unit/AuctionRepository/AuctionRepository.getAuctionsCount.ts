import { waffle, ethers } from "@nomiclabs/buidler";
const { deployMockContract } = waffle;
import chai from "chai";
const { expect } = chai;
import DeedRepositoryArtifact from "../../../build/artifacts/DeedRepository.json";
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";
import { duration, latestBlock } from "../../helpers/time";

export function getAuctionsCount(): void {
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

  it("returns zero (no auctions)", async function () {
    const auctionsCount = await this.auctionRepository.getAuctionsCount();

    expect(auctionsCount).to.equal(0);
  });

  it("returns one (one auction)", async function () {
    const deedId = "12345";
    const owner = this.signers[1];
    const ownerAddr = await owner.getAddress();

    // Deploy DeedRepository mock
    const mockDeedRepository = await deployMockContract(
      this.deployer,
      DeedRepositoryArtifact.abi,
    );

    await mockDeedRepository.mock.approve
      .withArgs(this.auctionRepository.address, deedId)
      .returns();
    await mockDeedRepository.mock["safeTransferFrom(address,address,uint256)"]
      .withArgs(ownerAddr, this.auctionRepository.address, deedId)
      .returns();
    await mockDeedRepository.mock.ownerOf.withArgs(deedId).returns(ownerAddr);

    // Create Auctions
    const startPrice = ethers.utils.parseEther("1");
    const blockDeadline = (await latestBlock())
      .add(duration.networkDeltaBlock())
      .add(duration.days("1"))
      .add(duration.seconds("2"))
      .toString();
    const deedRepositoryAddress = mockDeedRepository.address;
    const name = "Auction 1";
    const deedMetadata = "token metadata";

    // Auction 1
    await this.auctionRepository
      .connect(owner)
      .createAuction(
        deedId,
        startPrice,
        blockDeadline,
        deedRepositoryAddress,
        name,
        deedMetadata,
      );
    await this.auctionRepository.auctions(0);

    const auctionsCount = await this.auctionRepository.getAuctionsCount();

    expect(auctionsCount).to.equal(1);
  });
}
