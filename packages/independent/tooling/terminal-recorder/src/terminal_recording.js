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

import prettier from "prettier";
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

  const serverDirectoryUrl = new URL("../dist/", import.meta.url);
  const { startServer, createFileSystemFetch } = await import("@jsenv/server");
  const server = await startServer({
    logLevel: "warn",
    port: 0,
    routes: [
      {
        endpoint: "GET *",
        fetch: createFileSystemFetch(serverDirectoryUrl),
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
  debug,
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
  if (!svg && !gif && !video) {
    throw new Error("svg, video or gif must be enabled ");
  }
  const { chromium } = await import("playwright");
  const server = await startLocalServer();
  const browser = await chromium.launch({
    // channel: "chrome", // https://github.com/microsoft/playwright/issues/7716#issuecomment-882634893
    headless: !debug,
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
    console.log(`browser> ${consoleMessage.text()}`);
  });
  await page.goto(`${server.origin}/xterm.html`);
  await page.evaluate(
    /* eslint-disable no-undef */
    async ({ cols, rows, convertEol, textInViewport, gif, video, logs }) => {
      await window.xtreamReadyPromise;
      const __term__ = await window.initTerminal({
        cols,
        rows,
        convertEol,
        textInViewport,
        gif,
        video,
        logs,
      });
      window.__term__ = __term__;
    },
    /* eslint-enable no-undef */
    {
      cols,
      rows,
      convertEol: process.platform !== "win32",
      textInViewport: Boolean(svg),
      gif,
      video,
      logs,
    },
  );
  await page.evaluate(
    /* eslint-disable no-undef */
    async () => {
      const { writeIntoTerminal, stopRecording } =
        await window.__term__.startRecording();
      window.terminalRecording = { writeIntoTerminal, stopRecording };
    },
    /* eslint-enable no-undef */
  );
  writeCallbackSet.add(async (data, options) => {
    await page.evaluate(
      /* eslint-disable no-undef */
      async ({ data, options }) => {
        await window.terminalRecording.writeIntoTerminal(data, options);
      },
      /* eslint-enable no-undef */
      { data, options },
    );
  });
  stopCallbackSet.add(async () => {
    const recordedFormats = await page.evaluate(
      /* eslint-disable no-undef */
      () => {
        return window.terminalRecording.stopRecording();
      },
      /* eslint-enable no-undef */
    );
    if (!debug) {
      server.stop();
      browser.close();
    }
    terminalRecords.svg = async () => {
      const ansi = recordedFormats.textInViewport;
      const terminalSvg = renderTerminalSvg(ansi, svg);
      const terminalSvgFormatted = await prettier.format(terminalSvg, {
        parser: "html",
      });
      return terminalSvgFormatted;
    };
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
  let stopped = false;
  return {
    write: async (data, options) => {
      if (stopped) {
        throw new Error("write after stop()");
      }
      const promises = [];
      for (const writeCallback of writeCallbackSet) {
        promises.push(writeCallback(data, options));
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
