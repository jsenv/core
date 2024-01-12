import { writeFileSync } from "node:fs";
import { startTerminalRecording } from "@jsenv/terminal-recorder";

const terminalRecorder = await startTerminalRecording({
  svg: {
    title: "Terminal",
  },
});
await terminalRecorder.write(
  `[31mred [39m[33myellow [39m[32mgreen [39m[36mcyan [39m[34mblue [39m[35mmagenta[39m`,
);
const result = await terminalRecorder.stop();
const svg = await result.svg();
writeFileSync(new URL("./terminal.svg", import.meta.url), svg);
