import { writeFileSync } from "node:fs";

import { startTerminalRecording } from "@jsenv/terminal-snapshot";

const terminalRecorder = await startTerminalRecording({
  logs: true,
  // video: true,
  gif: true,
});
const datas = [
  `[31mred[39m `,
  `[33myellow[39m `,
  `[32mgreen[39m `,
  `[36mcyan[39m `,
  `[34mblue[39m `,
  `[35mmagenta[39m`,
];
for (const data of datas) {
  terminalRecorder.write(data);
  await new Promise((resolve) => setTimeout(resolve, 200));
}
const result = await terminalRecorder.stop();
const gif = await result.gif();
writeFileSync(new URL("./terminal.gif", import.meta.url), gif);
// const webm = await result.webm();
// writeFileSync(new URL("./terminal.webm", import.meta.url), webm);
// const mp4 = await result.mp4();
// writeFileSync(new URL("./terminal.mp4", import.meta.url), mp4);
