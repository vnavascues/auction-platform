// import {ethers} from "@nomiclabs/buidler";
// import {upgrades} from "@nomiclabs/buidler";
// const {upgrades} = require("@openzeppelin/buidler-upgrades");
import { upgrades } from "@nomiclabs/buidler";
//import {DeedRepository} from "../../build/typechain/DeedRepository";
// import {ContractFactory} from "ethers";

async function main() {
  const DeedRepository = await ethers.getContractFactory("DeedRepository");
  //const deedRepository = await DeedRepository.deploy("");
  const deedRepository = await upgrades.deployProxy(DeedRepository, [
    "Deed1",
    "DED1",
  ]);
  console.log("deedRepository:", deedRepository);
  await deedRepository.deployed();

  console.log("DeedRepository deployed to:", deedRepository.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
