import { task } from "@nomiclabs/buidler/config";

task("accounts", "Prints the list of accounts", async (taskArgs, bre) => {
  const accounts = await bre.ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.getAddress());
  }
});
