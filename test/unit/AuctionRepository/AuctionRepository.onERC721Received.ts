import { ethers } from "@nomiclabs/buidler";
import chai from "chai";
const { expect } = chai;
import { takeSnapshot, revertToSnapshot } from "../../helpers/snapshot";

export function onERC721Received(): void {
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

  it("returns the function signature (selector)", async function () {
    /*
     * Below the original way of obtaining the function signature:
     *  const selector = ethers.utils.keccak256(
     *    ethers.utils.toUtf8Bytes(
     *      "onERC721Received(address,address,uint256,bytes)",
     *    ),
     *  )
     *  .substring(0, 10);
     */
    const iface = new ethers.utils.Interface([
      "function onERC721Received(address,address,uint256,bytes)",
    ]);
    const expSignature = iface.getSighash("onERC721Received");
    const caller = this.signers[0];
    const operatorAddr = await this.signers[1].getAddress();
    const fromAddr = await this.signers[2].getAddress();
    const deedId = "12345";
    const data = ethers.utils.randomBytes(32);
    const signature = await this.auctionRepository
      .connect(caller)
      .callStatic.onERC721Received(operatorAddr, fromAddr, deedId, data);
    expect(signature).to.equal(expSignature);
  });

  it("emits the LogReceivedDeed event", async function () {
    const caller = this.signers[0];
    const operatorAddr = await this.signers[1].getAddress();
    const fromAddr = await this.signers[2].getAddress();
    const deedId = "12345";
    const data = ethers.utils.randomBytes(32);
    await expect(
      this.auctionRepository
        .connect(caller)
        .onERC721Received(operatorAddr, fromAddr, deedId, data),
    )
      .to.emit(this.auctionRepository, "LogReceivedDeed")
      .withArgs(operatorAddr, fromAddr, deedId);
  });
}
