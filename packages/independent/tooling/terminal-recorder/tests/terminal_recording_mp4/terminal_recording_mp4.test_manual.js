import { startTerminalRecording } from "@jsenv/terminal-recorder";
import { readFileSync, writeFileSync } from "node:fs";

const outputLines = readFileSync(
  new URL("./output.txt", import.meta.url),
  "utf8",
).split(/\n/g);

const terminalRecorder = await startTerminalRecording({
  video: true,
});
for (const line of outputLines) {
  terminalRecorder.write(`${line}\n`);
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}
const terminalRecords = await terminalRecorder.stop();
const terminalMp4 = await terminalRecords.mp4();
writeFileSync(new URL("./terminal.mp4", import.meta.url), terminalMp4);
