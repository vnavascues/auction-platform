import { BigNumber } from "ethers";

export interface Auction {
  id: BigNumber;
  deedId: BigNumber;
  startPrice: BigNumber;
  blockDeadline: BigNumber;
  owner: string;
  active: boolean;
  deedRepositoryAddress: string;
  ended: boolean;
  name: string;
  deedMetadata: string;
}

export interface Bid {
  price: BigNumber;
  from: string;
}
