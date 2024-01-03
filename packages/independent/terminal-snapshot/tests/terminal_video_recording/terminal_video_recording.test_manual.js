import { writeFileSync } from "node:fs";
import { startTerminalVideoRecording } from "@jsenv/terminal-snapshot";

const terminalVideoRecorder = await startTerminalVideoRecording({});

terminalVideoRecorder.write("hello\n");
await new Promise((resolve) => {
  setTimeout(resolve, 200);
});
terminalVideoRecorder.write("world");
const terminalVideo = await terminalVideoRecorder.stop();
const terminalVideoMp4 = await terminalVideo.mp4();
writeFileSync(new URL("./video.mp4", import.meta.url), terminalVideoMp4);
