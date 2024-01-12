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

import { renderTerminalSvg } from "./svg/render_terminal_svg.js";

const isDev = process.execArgv.includes("--conditions=development");

const startLocalServer = async () => {
  if (isDev) {
    const serverDirectoryUrl = new URL("./client/", import.meta.url);
    const { startDevServer } = await import("@jsenv/core");
    const devServer = await startDevServer({
      logLevel: "warn",
      port: 0,
      sourceDirectoryUrl: serverDirectoryUrl,
      keepProcessAlive: false,
      clientAutoreload: false,
      ribbon: false,
      handleSIGINT: false,
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

export const startTerminalRecording = async ({
  logs,
  cols,
  rows,
  svg,
  gif,
  video,
} = {}) => {
  const writeCallbackSet = new Set();
  const stopCallbackSet = new Set();
  const terminalRecords = {
    svg: () => {
      throw new Error("svg not recorded");
    },
    gif: () => {
      throw new Error("gif not recorded");
    },
    webm: () => {
      throw new Error("video not recorded");
    },
    mp4: () => {
      throw new Error("video not recorded");
    },
  };

  if (svg) {
    let ansi = "";
    writeCallbackSet.add((data) => {
      ansi += data;
    });
    stopCallbackSet.add(() => {
      terminalRecords.svg = async () => {
        const terminalSvg = await renderTerminalSvg(ansi, svg);
        ansi = "";
        return terminalSvg;
      };
    });
  }
  if (gif || video) {
    const { chromium } = await import("playwright");
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
    page.on("console", (consoleMessage) => {
      console.log(`chrome> ${consoleMessage.text()}`);
    });
    await page.goto(`${server.origin}/xterm.html`);
    await page.evaluate(
      /* eslint-env browser */
      async ({ cols, rows, convertEol, gif, video, logs }) => {
        await window.xtreamReadyPromise;
        const __term__ = await window.initTerminal({
          cols,
          rows,
          convertEol,
          gif,
          video,
          logs,
        });
        window.__term__ = __term__;
      },
      {
        cols,
        rows,
        convertEol: process.platform !== "win32",
        gif,
        video,
        logs,
      },
      /* eslint-env node */
    );
    await page.evaluate(
      /* eslint-env browser */
      async () => {
        const { writeIntoTerminal, stopRecording } =
          await window.__term__.startRecording();
        window.terminalRecording = { writeIntoTerminal, stopRecording };
      },
      /* eslint-env node */
    );

    writeCallbackSet.add(async (data) => {
      await page.evaluate(
        /* eslint-env browser */
        (data) => {
          window.terminalRecording.writeIntoTerminal(data);
        },
        data,
        /* eslint-env node */
      );
    });

    stopCallbackSet.add(async () => {
      const recordedFormats = await page.evaluate(
        /* eslint-env browser */
        () => {
          return window.terminalRecording.stopRecording();
        },
        /* eslint-env node */
      );
      server.stop();
      browser.close();

      terminalRecords.gif = () => {
        const terminalGifBuffer = Buffer.from(recordedFormats.gif, "binary");
        return terminalGifBuffer;
      };
      terminalRecords.webm = () => {
        const terminalWebmBuffer = Buffer.from(recordedFormats.video, "binary");
        return terminalWebmBuffer;
      };
      terminalRecords.mp4 = async () => {
        const terminalWebmBuffer = Buffer.from(terminalRecords.video, "binary");
        const webmToMp4Namespace = await import("webm-to-mp4");
        const webmToMp4 = webmToMp4Namespace.default;
        const terminalMp4Buffer = Buffer.from(webmToMp4(terminalWebmBuffer));
        return terminalMp4Buffer;
      };
    });
  }
  return {
    write: async (data) => {
      const promises = [];
      for (const writeCallback of writeCallbackSet) {
        promises.push(writeCallback(data));
      }
      await Promise.all(promises);
    },
    stop: async () => {
      const promises = [];
      for (const stopCallback of stopCallbackSet) {
        promises.push(stopCallback());
      }
      writeCallbackSet.clear();
      stopCallbackSet.clear();
      await Promise.all(promises);
      return terminalRecords;
    },
  };
};
