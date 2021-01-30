import { Command } from "commander";
import { Admin } from "../admin";
import { HubRegistryTreeDB } from "../dataProvider";
import { LevelDB } from "../db";
import { loadConfigs, parseAdminConfig } from "./configs";
import { dbDir } from "./defaults";
import { getBlindFindContract } from "./provider";
import { base64ToObj, objToBase64 } from "./utils";
import { objToHubRegistry } from "../dataProvider";

export const buildCommandAdmin = () => {
  const adminCommand = new Command("admin");
  adminCommand
    .command("addHub")
    .arguments("<hubRegistry>")
    .description("add a hub registry to the merkle tree", {
      hubRegistry: "a HubRegistry object encoded in base64"
    })
    .action(async (hubRegistryB64: string) => {
      // Example input: 'eyJzaWciOnsiUjgiOlsiMTYwODk5NjE4OTM5NTIxMDE1OTk4NzE3ODQ4Mjg5NzUzMTI0MjQzMDIxNjMwMTI2MjgzOTYzMTc5MjY0ODE5ODUzMjAzNTM2NTQ4MzAiLCIxMjM4MTQ0NzE3MjQyOTY3MDEzNDAxMDMyODc2MTAxMzA4MDk4NjA1OTczODIyMTY3MTk0MzI5MTgxNzE5MTM0OTA3NjE2MTE0NTcxMiJdLCJTIjoiMTc1ODgzOTAyNzE3MTU4ODQ5NDA0MzU3MDUwODk0MTczMDM4MjkyNDMxMjk0OTUwMDE1NzY5MTA2MjI5NjYyMTY5MjA5NjIyMjA3In0sInB1YmtleSI6WyIxMDA4NTIxODIxOTYxNTQ4MTY4NzI3OTU4OTEzNzk1NjMwNDA1MzYyMzk1OTU1MDk0MDcyNDUzMDY0MTU0NDY0ODE0NzM2NTEwMzg0NSIsIjE5MDM3MDY2MDA2NDI1Mjg3MTczMDIzNTgxNDE1NTA2Nzg0NTk2Nzg1MTkwMjE5ODI4MDY2NzE1MDc3Njg1MjU2MDQ3MjQ5NDc5MjgyIl0sImFkbWluQWRkcmVzcyI6IjEzMjA4MTYyNDk4NTA2ODU2NjA1MTQxODA4MzY4MjgxNTgxOTcwMDcyOTE2NTA0OTEifQ=='
      const hubRegistry = objToHubRegistry(base64ToObj(hubRegistryB64));
      const admin = await getAdmin();
      await admin.insertHubRegistry(hubRegistry);
      const index = admin.treeDB.getIndex(hubRegistry);
      if (index === undefined) {
        throw new Error("internal error: index shouldn't be undefined");
      }
      const proof = admin.treeDB.tree.tree.genMerklePath(index);
      // Example output: 'eyJwYXRoRWxlbWVudHMiOltbIjAiXSxbIjEwNjAwOTc0NDg0NDgzNjM2NjQ5MTkxODM2MTgzMzMxODU5NTE0NDU0MTA4NDc2ODI2Mzc2MzU3OTQxMzU2MjkyNTc4MDk5MzcyNDAwIl0sWyIyMTc5NDQ3Njc3ODQyNzM3NzEyNjA1OTM2NjQ0OTc4ODY4NjYwNzg5NTk0NTQwMDY3NTA0Mjk0MTI4MDEwMjA5MzY2NTU1OTU5ODE3NSJdLFsiMjQzNjkyOTQxMjQwOTI3Mzk3MTI0Nzg5NzM0Mjk2MzgzNjIwNjEwOTcyNTM4NDkwOTk4OTAxODk5MzYwNDQ0Mzc4NjE5NjE2NzA3OSJdLFsiMTY3OTU5NzEyMTIzNTE1MjIzODkyNjM3MTA4NjMxMzcwNzcwNzgyMTQ4MjUxNjk4NDY1MDkwMTE5Mjk0OTk2MDA5NjQ0OTk3MzUwNTAiXSxbIjEzMjE5NjgxNjUyODAyMjYyNDAwMjI2NTQxMzgyNDk3NzQ0ODU5NzI1MjI4ODc5NTU3NDk5MjIzNzA2NjU2NTYwNTA4ODU4MzMyMjg0Il0sWyIxNjA3NzQxNTA0MzMzNTI5NTgzOTYwMzI4NzEzMzg1ODY4MjQ0Njk3MjA4MzAwMDgzMTQyMTQ5MjEyOTkwMzg2MDU2MjM4MDY2OTYzNyJdLFsiNTAyMzI3NTUyNzk0MDE4ODMwNDkyOTYzOTM5NDY4OTg2MDk1Nzc4NTg4ODczNzMyMzk1MjQxMzAyODYyNjcyNTAxMzc0ODY2NDY5Il0sWyIxNzMxNjkzMjUzMDgyMjg0NzMxMDc3ODI5NzUxMTg5Mzc4MjA4OTIzMDUzMTY0Nzk3NTQ0MzI2NDQ2Njg1MTY5MzcwNTk0MjM5OTIxMyJdLFsiMTU2MTY5NjcxNzQwNzc4ODkxNTIwOTM4OTg2OTY0NDE0NjIwMTAyMzUyMTI4MDY2MDg0MTY1NDk2NTYxODg5MjQ0MDUyNjAyNDc1MjAiXSxbIjEyMTkwODIxNDA0OTcxNTMzMDE5MTY1NDI2MDkyNTEzNDYxMDc2MDI4NDM3OTU3MjkxOTAyNjMyODM4OTk5MDU1ODIxODk3NTgzNDkwIl0sWyIxNjU1NTAyODQ0OTc5Nzc5MjQ4MDU3MjgzMjUwNjk5MjM3MjUzNTIwMTE1ODY3NzcxNDk0NTgwMzg3OTAxMjI1MTM1NDc2MzMzMTg1OSJdLFsiODIzMTcwNTIzMDI0MDY1MTIzMDUzNzU3MjcyNTUzMDgzMzEyNzQ0NDk0NDI4MzAwMDAwNDYyMzkyODUzNjYxOTYyODIyODkzNDE5NCJdLFsiMzA3NzU1MDcyMzQzNzkxNTQxOTEwNDIwNzAxMjU3OTU3NTczNDIzMTcwMTg0NDg1Mzk3NjE2NzE0NDUzMDE3OTIxMjQyNDA1MDkzMSJdLFsiMjE3NjM2OTY0NTY5MjM4NzMzNjUwNzM3NTQwODA2NDUxOTgwMjY0NjE0MjMwNDYzNjA4MzE3MDQwNTc5Njk2NjQ1ODM1MTU5MDE3MjEiXSxbIjY3MTQxMDg2MjU5ODQ1NzY1OTk0ODI2NzkxNjg2MTg1NTYzNjY0NTExNTA4NDY5NTc1MzEwMzIzMzIwNjIxMzM5ODk4MzA1MDM2Il0sWyIzNjI0MjA4NTk4MjY1OTA0ODg2NzM4OTY4Njg1ODAzNjE1MTUyOTc1NDcyNDYzNTM4OTk3OTkxMTM5NTc1MDQ4NTM0NjEwNDI0NzE3Il0sWyI4Njc2MTQ0ODUxMjg4MTg1ODcwODk2MTAzMzUxODc4Mzg5NzczNzgyMjQ3MDY4ODk5MDkyMzU5NjMxMjg5NzA0NzM3NDEyMDQyMjMyIl0sWyIxMzIzODMzMDY0MDY0ODAwNzUyODYzNDE2MDQ0OTM1MDUzNjEyNTkxNjE2OTI5NTM0MjE0MDA1OTc1NzI1NzY5MTE5MjEyNjg2Nzk3OSJdLFsiNzYyOTk3OTQwMDAxOTE3MTMzNzE2ODQyMzQxNDYwOTI0NDM2NTMxODg3MTMyNDEzMjQ3Nzg4NjM5MjAwOTY1NjkzMzI0ODkxOTY0NCJdLFsiMTcyMTY3MDgyNjc0OTE3MTY4MjA3NjU5Nzc3Njk3NTMzNDk1NDY0MDkzMzgxMDA0NzExNDAyMjQ3MDc1Njg5MzUxNDAwMTUyMzk1NDEiXSxbIjExMDMyMDM3NjgyMjc2OTcxNDc1MzcwNzk3Mjc0NjUyOTUxODE4ODE3NDE5MzQ2MDU1Njc4NTM4Mzg2NTIwNzcwMzQ2MTUwNTU0ODU4Il0sWyIxMDUxMzE4ODY1NTYxMjI2NDYxMDYzOTMwOTM0NTM1NzAyMzU3MjgxOTY3NDQxNzA4OTgyMjI0MzU0Mzc4OTQyNjE5NTM3MjUxOTQ1OCJdLFsiMjA4MzAyNDY0ODQxOTkxNDQxMjEyNzA0NTk3NzY2MDk2MTg0Nzc0MjYxMDM2NjUxMDA3ODQxNTg1OTgzMDQwMDU1MzIxNzEyMzEzMTYiXSxbIjE0NjQzOTU5MDUyODA2MzcwMjk1NzgzNjIyMTgyOTI2MzA3OTIxOTU2NzEzOTkyNTQ2NDMwNjQxODMyNDg3NjY3NTc2NDg3MDQ2MDcxIl0sWyIxMjExOTI5MTU3MjYzOTgzMTQ0MDY3ODA4MTYxODc5NTk0MDE5NDI1ODY0ODU3NDY3OTU1MDE0ODkxODAwNjc5OTk3OTg4MTI4NDQ2NCJdLFsiMTM3NTA1NjM5MTU0MDg1OTYyMTg1OTMxNDI5MDEzOTU0ODY1MzU4MzI0NzI4OTkyMzYxNzY1NzMzMDQ0NTE0Mzk4MTExNTY1NTcwNTUiXSxbIjEyOTA3NjA2MTc4NTc2MTMxNzkzNzAyMjI5Nzc2MzM2MTk1NTg0NTg3Mzc5NTc5ODI5MjYwMjEwMDk1ODg2ODAzOTM3ODIyOTM4NTI4Il0sWyIxMzU2NjE3NjA2MDM2NTk0NTEwNzQ2MDUwMDgyMzQ2NDM0MDA0NjgwNDgyNDAwNDcwNDEwNDM4NjM3MzcwMzc1Nzk0NjgyNjI1NTQ0MyJdLFsiMzAwOTAxNzUwNjczNjQ4NTIyMDIzOTk5NjM5NTcyNjI5OTMwNjk5NjA5Nzc4NzMxMTA0ODAxOTYzMjIzMjIyOTAzMDQyMzY4MDU4NyJdLFsiMjE3MjQ4NDU5ODIzMzk5OTQxMzc3MTE5NDQ4MjU1NDI4ODAxMDYxMDg3MzU1MjI2MTc4OTQ5NDc1NDE2Mzc5NTA0MjQxMDEzMzk0NDkiXSxbIjYwMzg2NjQ1Mjg0NDYzMTk5NTgzNDQ1NDY1NTcyNzI4MTY0MjIwNTM4ODU4MDM5OTUzODg0MjUxNjUwOTE4MDgzOTI5NzYzNTE1Il1dLCJpbmRpY2VzIjpbMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwXSwiZGVwdGgiOjMyLCJyb290IjoiNDc5NjYyNDk5Nzc1NDM2NzY5OTMyMTQ0NDk5ODAyNzg4MzM0MjY5OTcyNTAwNTcxODQ1NjAwNzI3MDgwMjM0NjYxNzQ1Mjg5ODM3NCIsImxlYWYiOiIxMTI1NDU5Nzk0MDc4MDQxNjUyNjc4MjI4MDY2Mjg2MzA3ODMwMzc5MzYyNzQ4NDg4MDc5MTc3OTU5MzIyNDIzOTQzODQ1NDA2NjAzMiJ9'
      console.log("Proof in base64 encoding:", objToBase64(proof));
    });
  return adminCommand;
};

const getAdmin = async () => {
  const configs = await loadConfigs();
  const networkConfig = configs.network;
  const adminConfig = parseAdminConfig(configs);
  const blindFindContract = getBlindFindContract(
    networkConfig,
    adminConfig.adminEthereumPrivkey
  );
  const levelDB = new LevelDB(dbDir);
  const treeDB = await HubRegistryTreeDB.fromDB(levelDB);
  return new Admin(blindFindContract, treeDB);
};
