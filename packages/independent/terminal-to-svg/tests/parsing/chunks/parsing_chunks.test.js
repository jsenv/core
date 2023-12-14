import { readFileSync, writeFileSync } from "node:fs";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { parse } from "@jsenv/terminal-to-svg/src/parse.js";

const test = (file) => {
  const fixtureFileUrl = new URL(`./fixtures/${file}`, import.meta.url);
  const snapshotFileUrl = new URL(`./snapshots/${file}.json`, import.meta.url);

  const fileSnapshot = takeFileSnapshot(snapshotFileUrl);
  const fixtureFileContent = readFileSync(fixtureFileUrl, "utf8");
  const { chunks } = parse(fixtureFileContent);
  writeFileSync(snapshotFileUrl, JSON.stringify(chunks, null, "  "));
  fileSnapshot.compare();
};

test("chalk.txt");
test("robot.txt");
