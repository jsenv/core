import { readFileSync, writeFileSync } from "node:fs";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { renderTerminalSvg } from "@jsenv/terminal-to-svg";

const test = (file) => {
  const ansiFixtureFileUrl = new URL(`./fixtures/${file}`, import.meta.url);
  const svgSnapshotFileUrl = new URL(
    `./snapshots/${file}.svg`,
    import.meta.url,
  );

  const svgFileSnapshot = takeFileSnapshot(svgSnapshotFileUrl);
  const ansi = readFileSync(ansiFixtureFileUrl, "utf8");
  const svgString = renderTerminalSvg(ansi);
  writeFileSync(svgSnapshotFileUrl, svgString);
  svgFileSnapshot.compare();
};

test("jsenv_test_output.txt");
