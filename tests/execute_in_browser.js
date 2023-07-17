import { chromium } from "playwright";

export const executeInBrowser = async ({
  browserLauncher = chromium,
  url,
  headScriptUrl,
  pageFunction,
  pageArguments = [],
  collectConsole = false,
  collectErrors = false,
  debug = false,
  headless = !debug,
  autoStop = !debug,
}) => {
  const browser = await browserLauncher.launch({ headless });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });

  const consoleOutput = {
    raw: "",
    logs: [],
    debugs: [],
    warnings: [],
    errors: [],
    infos: [],
  };

  const logTypes = {
    log: consoleOutput.logs,
    debug: consoleOutput.debugs,
    info: consoleOutput.infos,
    warning: consoleOutput.warnings,
    error: consoleOutput.errors,
  };
  page.on("console", (message) => {
    if (collectConsole) {
      const type = message.type();
      const text = message.text();
      logTypes[type].push(text);
      consoleOutput.raw += text;
    } else if (message.type() === "error") {
      console.error(message.text());
    }
  });

  const pageErrors = [];
  page.on("pageerror", (error) => {
    if (collectErrors) {
      pageErrors.push(error);
    } else {
      throw error;
    }
  });

  await page.goto(url);
  if (headScriptUrl) {
    // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pageaddscripttagoptions
    await page.addScriptTag({ url: headScriptUrl });
  }

  let result = {
    returnValue: undefined,
    pageErrors,
    consoleOutput,
  };

  try {
    const returnValue = pageFunction
      ? await page.evaluate(pageFunction, ...pageArguments)
      : undefined;
    result.returnValue = returnValue;
  } finally {
    if (autoStop) {
      await closeBrowser(browser);
    }
  }
  return result;
};

const closeBrowser = async (browser) => {
  const disconnected = browser.isConnected()
    ? new Promise((resolve) => {
        const disconnectedCallback = () => {
          browser.removeListener("disconnected", disconnectedCallback);
          resolve();
        };
        browser.on("disconnected", disconnectedCallback);
      })
    : Promise.resolve();
  // for some reason without this timeout
  // browser.close() never resolves (playwright does not like something)
  await new Promise((resolve) => setTimeout(resolve, 50));
  try {
    await browser.close();
  } catch (e) {
    if (isTargetClosedError(e)) {
      return;
    }
    throw e;
  }
  await disconnected;
};

const isTargetClosedError = (error) => {
  if (error.message.match(/Protocol error \(.*?\): Target closed/)) {
    return true;
  }
  if (error.message.match(/Protocol error \(.*?\): Browser.*?closed/)) {
    return true;
  }
  return error.message.includes("browserContext.close: Browser closed");
};
