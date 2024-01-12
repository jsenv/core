import { readFileSync, writeFileSync } from "node:fs";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { parseAnsi } from "@jsenv/terminal-recorder/src/svg/parse_ansi.js";

const test = (file) => {
  const ansiFixtureFileUrl = new URL(`./fixtures/${file}`, import.meta.url);
  const jsonSnapshotFileUrl = new URL(
    `./snapshots/${file}.json`,
    import.meta.url,
  );

  const jsonFileSnapshot = takeFileSnapshot(jsonSnapshotFileUrl);
  const ansi = readFileSync(ansiFixtureFileUrl, "utf8");
  const { chunks } = parseAnsi(ansi);
  writeFileSync(jsonSnapshotFileUrl, JSON.stringify(chunks, null, "  "));
  jsonFileSnapshot.compare();
};

test("chalk.txt");
test("rainbow.txt");
test("red_underscore.txt");
test("reset_styles.txt");
test("robot.txt");
test("your_wish_is_my_command.txt");
