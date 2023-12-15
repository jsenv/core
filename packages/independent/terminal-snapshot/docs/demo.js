import { writeFileSync } from "node:fs";
import { renderTerminalSvg } from "@jsenv/terminal-snapshot";

const terminalSvg = await renderTerminalSvg(
  `[31mred [39m[33myellow [39m[32mgreen [39m[36mcyan [39m[34mblue [39m[35mmagenta[39m`,
  {
    title: "Terminal",
  },
);
writeFileSync(new URL("./terminal.svg", import.meta.url), terminalSvg);
