import { writeFileSync, readFileSync } from "node:fs";
import { startTerminalRecording } from "@jsenv/terminal-snapshot";

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
writeFileSync(new URL("./video.mp4", import.meta.url), terminalMp4);
