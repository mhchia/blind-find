#!/usr/bin/env node

import { Command } from "commander";
import { buildCommandAdmin } from "./admin";
import { BlindFindConfig } from "./configs";
import * as defaults from "./defaults";
import { buildCommandGeneral } from "./general";
import { buildCommandHub } from "./hub";
import { buildCommandUser } from "./user";

// NOTE: Workaround: parse arguments twice to get the global options.
//  https://github.com/tj/commander.js/issues/1229.
async function main() {
  const program = new Command();
  program
    .description("Blind Find v1")
    .version("0.0.1") // TODO: Parse from other places?
    .enablePositionalOptions()
    .passThroughOptions()
    // TODO: Add an option for logger level.
    .option(
      "-d, --data-dir <dir>",
      "directory storing data blind find uses",
      defaults.dataDir
    )
    .parse();
  const globalOpts = program.opts();
  const config = await BlindFindConfig.loadFromDataDir(globalOpts.dataDir);
  await program
    .description("Blind Find v1")
    .addCommand(buildCommandGeneral(config))
    .addCommand(buildCommandAdmin(config))
    .addCommand(buildCommandHub(config))
    .addCommand(buildCommandUser(config))
    .parseAsync();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    // console.error(error);
    console.log(error);
    process.exit(1);
  });
