import { readFileSync, writeFileSync } from "node:fs";
import { takeFileSnapshot } from "@jsenv/snapshot";

import { startTerminalRecording } from "@jsenv/terminal-recorder";

const test = async (file, snapshotFilename = `${file}.svg`, options) => {
  const ansiFixtureFileUrl = new URL(`./fixtures/${file}`, import.meta.url);
  const svgSnapshotFileUrl = new URL(
    `./snapshots/${snapshotFilename}`,
    import.meta.url,
  );

  const svgFileSnapshot = takeFileSnapshot(svgSnapshotFileUrl);
  const terminalRecorder = await startTerminalRecording({
    svg: options,
  });
  const ansi = readFileSync(ansiFixtureFileUrl, "utf8");
  terminalRecorder.write(ansi);
  const result = await terminalRecorder.stop();
  const svg = await result.svg();
  writeFileSync(svgSnapshotFileUrl, svg);
  svgFileSnapshot.compare();
};

await test("jsenv_test_output.txt", "jsenv_test_output_width_640.svg", {});
await test("jsenv_test_output.txt", "jsenv_test_output_width_auto.svg", {
  width: "auto",
});
await test(
  "jsenv_test_output.txt",
  "jsenv_test_output_width_auto_height_480.svg",
  {
    width: "auto",
    height: 480,
  },
);
