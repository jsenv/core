import { readFileSync, writeFileSync } from "node:fs";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { renderTerminalSvg } from "@jsenv/terminal-snapshot";

const test = (file, snapshotFilename = `${file}.svg`, options) => {
  const ansiFixtureFileUrl = new URL(`./fixtures/${file}`, import.meta.url);
  const svgSnapshotFileUrl = new URL(
    `./snapshots/${snapshotFilename}`,
    import.meta.url,
  );

  const svgFileSnapshot = takeFileSnapshot(svgSnapshotFileUrl);
  const ansi = readFileSync(ansiFixtureFileUrl, "utf8");
  const svgString = renderTerminalSvg(ansi, options);
  writeFileSync(svgSnapshotFileUrl, svgString);
  svgFileSnapshot.compare();
};

test("jsenv_test_output.txt", "jsenv_test_output.svg");
test("jsenv_test_output.txt", "jsenv_test_output_auto.svg", {
  width: "auto",
});
