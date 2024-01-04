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

import { chromium } from "playwright";

const isDev = process.execArgv.includes("--conditions=development");

const startLocalServer = async () => {
  if (isDev) {
    const serverDirectoryUrl = new URL("./", import.meta.url);
    const { startDevServer } = await import("@jsenv/core");
    const devServer = await startDevServer({
      logLevel: "warn",
      port: 0,
      sourceDirectoryUrl: serverDirectoryUrl,
      keepProcessAlive: false,
      clientAutoreload: false,
      ribbon: false,
    });
    return devServer;
  }

  const serverDirectoryUrl = new URL("../../dist/", import.meta.url);
  const { startServer, fetchFileSystem } = await import("@jsenv/server");
  const server = await startServer({
    logLevel: "warn",
    port: 0,
    services: [
      {
        handleRequest: async (request) => {
          const fileUrl = new URL(
            request.resource.slice(1),
            serverDirectoryUrl,
          );
          const response = await fetchFileSystem(fileUrl, request);
          return response;
        },
      },
    ],
  });
  return server;
};

export const startTerminalVideoRecording = async ({ mimeType } = {}) => {
  const server = await startLocalServer();
  const browser = await chromium.launch({
    channel: "chrome", // https://github.com/microsoft/playwright/issues/7716#issuecomment-882634893
    headless: true,
    // needed because https-localhost fails to trust cert on chrome + linux (ubuntu 20.04)
    args: ["--ignore-certificate-errors"],
  });
  const page = await browser.newPage({
    ignoreHTTPSErrors: true,
  });
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto(`${server.origin}/xterm.html`);
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
    async ({ mimeType }) => {
      await window.startRecording({
        mimeType,
      });
    },
    { mimeType },
    /* eslint-env node */
  );
  return {
    write: async (data) => {
      await page.evaluate(
        /* eslint-env browser */
        (data) => {
          window.writeIntoTerminal(data);
        },
        data,
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
      server.stop();
      browser.close();
      const videoWebmBuffer = Buffer.from(videoWebmAsBinayString, "binary");
      return {
        webm: () => {
          return videoWebmBuffer;
        },
        mp4: async () => {
          const webmToMp4Namespace = await import("webm-to-mp4");
          const webmToMp4 = webmToMp4Namespace.default;
          const videoMp4Buffer = Buffer.from(webmToMp4(videoWebmBuffer));
          return videoMp4Buffer;
        },
      };
    },
  };
};
