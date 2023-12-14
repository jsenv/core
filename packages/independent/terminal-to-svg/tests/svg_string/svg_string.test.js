import { readFileSync, writeFileSync } from "node:fs";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { svgFromAnsi } from "@jsenv/terminal-to-svg/src/svg_from_ansi.js";

const test = (file) => {
  const ansiFixtureFileUrl = new URL(`./fixtures/${file}`, import.meta.url);
  const svgSnapshotFileUrl = new URL(
    `./snapshots/${file}.svg`,
    import.meta.url,
  );

  const svgFileSnapshot = takeFileSnapshot(svgSnapshotFileUrl);
  const ansi = readFileSync(ansiFixtureFileUrl, "utf8");
  const svgString = svgFromAnsi(ansi);
  writeFileSync(svgSnapshotFileUrl, svgString);
  svgFileSnapshot.compare();
};

test("jsenv_test_output.txt");
