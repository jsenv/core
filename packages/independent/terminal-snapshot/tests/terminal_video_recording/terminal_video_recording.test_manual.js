import { writeFileSync, readFileSync } from "node:fs";
import { startTerminalVideoRecording } from "@jsenv/terminal-snapshot";

const outputLines = readFileSync(
  new URL("./output.txt", import.meta.url),
  "utf8",
).split(/\n/g);

const terminalVideoRecorder = await startTerminalVideoRecording();
for (const line of outputLines) {
  terminalVideoRecorder.write(`${line}\n`);
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}
const terminalVideo = await terminalVideoRecorder.stop();
const terminalVideoMp4 = await terminalVideo.mp4();
writeFileSync(new URL("./video.mp4", import.meta.url), terminalVideoMp4);
