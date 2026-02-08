import { takeDirectorySnapshot } from "@jsenv/snapshot";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import { readFileSync, writeFileSync } from "node:fs";

if (
  process.env.CI &&
  (process.platform === "win32" ||
    // fail since update of macos, see https://github.com/microsoft/playwright/issues/30585
    process.platform === "darwin")
) {
  process.exit(0);
}

const test = async (file, snapshotFilename = `${file}.svg`, options = {}) => {
  const ansiFixtureFileUrl = new URL(`./fixtures/${file}`, import.meta.url);
  const svgOutputFileUrl = new URL(
    `./output/${snapshotFilename}`,
    import.meta.url,
  );
  const terminalRecorder = await startTerminalRecording(options);
  const ansi = readFileSync(ansiFixtureFileUrl, "utf8");
  terminalRecorder.write(ansi);
  const result = await terminalRecorder.stop();
  const svg = await result.svg();
  writeFileSync(svgOutputFileUrl, svg);
};

const outputDirectorySnapshot = takeDirectorySnapshot(
  new URL("./output/", import.meta.url),
);
await test("hello_world_2_lines.txt", "hello_world_2_lines.svg", {
  svg: true,
});
await test("special.txt", "special_width_640.svg", {
  svg: true,
});
await test("jsenv_test_output.txt", "jsenv_test_output_width_640.svg", {
  svg: true,
});
await test("jsenv_test_output.txt", "jsenv_test_output_width_auto.svg", {
  svg: {
    width: "auto",
  },
});
await test(
  "jsenv_test_output.txt",
  "jsenv_test_output_width_auto_height_480.svg",
  {
    svg: {
      width: "auto",
      height: 480,
    },
  },
);
await test("a_space_b.txt", "a_space_b.svg", {
  svg: true,
});
await test("jsenv_test_output.txt", "jsenv_test_output_last_10_lines.svg", {
  rows: 10,
  svg: true,
});
outputDirectorySnapshot.compare();
