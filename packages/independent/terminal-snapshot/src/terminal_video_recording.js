/* 
 - start dev server (must be able to find xterm.html)
 - start chrome
 - visit xterm.html
 - call page.evaluate of initTerminal()
 - call page.evaluate startRecording
 - do some page.evaluate window.writeIntoTerminal()
 - call page.evaluate stopRecording
 - we should have a webm video
*/

import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { startDevServer } from "@jsenv/core";

export const startTerminalVideoRecording = async () => {
  const devServer = await startDevServer({
    sourceDirectoryUrl: new URL("./", import.meta.url),
    keepProcessAlive: false,
    clientAutoreload: false,
    ribbon: false,
  });
  const browser = await chromium.launch({
    headless: true,
    // needed because https-localhost fails to trust cert on chrome + linux (ubuntu 20.04)
    args: ["--ignore-certificate-errors"],
  });
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
  });
  await page.goto(`${devServer.origin}/xterm.html`);
  await page.evaluate(
    /* eslint-env browser */
    async () => {
      await window.xtreamReadyPromise;
      await window.initTerminal();
    },
    /* eslint-env node */
  );
  await page.evaluate(
    /* eslint-env browser */
    async () => {
      await window.startRecording();
    },
    /* eslint-env node */
  );
  return {
    write: async () => {
      await page.evaluate(
        /* eslint-env browser */
        () => {
          window.writeIntoTerminal("hello");
        },
        /* eslint-env node */
      );
    },
    stop: async () => {
      const videoWebmAsBinayString = await page.evaluate(
        /* eslint-env browser */
        () => {
          return window.stopRecording();
        },
        /* eslint-env node */
      );
      const videoWebmAsBuffer = Buffer.from(videoWebmAsBinayString, "binary");
      devServer.stop();
      browser.close();
      return videoWebmAsBuffer;
    },
  };
};

const terminalVideoRecorder = await startTerminalVideoRecording();

terminalVideoRecorder.write("hello");
await new Promise((resolve) => {
  setTimeout(resolve, 500);
});
terminalVideoRecorder.write("world");
const videoWebmAsBuffer = await terminalVideoRecorder.stop();
writeFileSync(new URL("./video.webm", import.meta.url), videoWebmAsBuffer);
