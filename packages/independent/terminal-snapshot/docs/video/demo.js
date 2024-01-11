import { writeFileSync } from "node:fs";

import { startTerminalRecording } from "@jsenv/terminal-snapshot";

const terminalRecorder = await startTerminalRecording({
  video: true,
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
const mp4 = await result.mp4();
writeFileSync(new URL("./terminal.mp4", import.meta.url), mp4);
