import { TASK_COMPILE } from "@nomiclabs/buidler/builtin-tasks/task-names";
import { TypeChain } from "typechain/dist/TypeChain";
import { task } from "@nomiclabs/buidler/config";
import { tsGenerator } from "ts-generator";

import { TASK_TYPECHAIN } from "./task-names";

task(
  TASK_TYPECHAIN,
  "Generate Typechain typings for compiled contracts",
  async function (_taskArgs, { config, run }) {
    await run(TASK_COMPILE);

    console.log(
      `Creating TypeChain artifacts in directory ${config.paths.typechain} for target ${config.typechain.target}`,
    );

    const cwd: string = process.cwd();
    await tsGenerator(
      { cwd },
      new TypeChain({
        cwd,
        rawConfig: {
          files: config.paths.artifacts + "/*.json",
          outDir: config.paths.typechain,
          target: config.typechain.target,
        },
      }),
    );

    console.log(`Successfully generated TypeChain artifacts!`);
  },
);
