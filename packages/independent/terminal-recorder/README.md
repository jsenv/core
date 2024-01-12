# terminal snapshot [![npm package](https://img.shields.io/npm/v/@jsenv/terminal-recorder.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/terminal-recorder)

Help to generate beautiful terminal snapshots:

- Record terminal as svg
- Record terminal as video (mp4 or webm)

## Recording as SVG

![toto](./docs/svg/terminal.svg)

```js
import { writeFileSync } from "node:fs";
import { renderTerminalSvg } from "@jsenv/terminal-recorder";

const terminalSvg = await renderTerminalSvg(
  `[31mred [39m[33myellow [39m[32mgreen [39m[36mcyan [39m[34mblue [39m[35mmagenta[39m`,
  {
    title: "Terminal",
  },
);
writeFileSync(new URL("./terminal.svg", import.meta.url), terminalSvg);
```

## Recording a video/gif

![toto](./docs/animated/terminal.gif)

```js
import { writeFileSync } from "node:fs";

import { startTerminalRecording } from "@jsenv/terminal-recorder";

const terminalRecorder = await startTerminalRecording({
  video: true,
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
const webm = await result.webm();
writeFileSync(new URL("./terminal.webm", import.meta.url), webm);
const mp4 = await result.mp4();
writeFileSync(new URL("./terminal.mp4", import.meta.url), mp4);
```

The terminal video recording uses xterm and chrome via playwright.  
xterm is used by VsCode terminal so it behaves like VsCode terminal. It supports ansi, unicode and so on.
