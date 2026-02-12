import { markAsInternalError } from "@jsenv/exception";

export const executePageFunction = async (
  page,
  {
    /* eslint-disable no-undef */
    pageFunction = () => window.resultPromise,
    /* eslint-enable no-undef */
    pageArguments = [],
    collectConsole = false,
    collectErrors = false,
    mirrorConsole = false,
  } = {},
) => {
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
  const consoleCallback = (message) => {
    const type = message.type();
    if (collectConsole) {
      const text = message.text();
      logTypes[type].push(text);
      consoleOutput.raw += text;
    } else if (mirrorConsole) {
      console[type === "warning" ? "warn" : type](
        `console.${type} > ${message.text()}`,
      );
    } else if (type === "error") {
      console.error(message.text());
    }
  };
  page.on("console", consoleCallback);

  const pageErrors = [];
  if (collectErrors) {
    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });
  }
  const result = {
    returnValue: undefined,
    pageErrors,
    consoleOutput,
  };

  const errorPromise = collectErrors
    ? new Promise(() => {})
    : new Promise((resolve, reject) => {
        const errorCallback = (error) => {
          page.off("pageerror", errorCallback);
          page.on("pageerror", (error) => {
            throw error;
          });
          reject(
            markAsInternalError(new Error(`"pageerror"`, { cause: error })),
          );
        };
        page.on("pageerror", errorCallback);
      });

  const resultPromise = (async () => {
    const returnValue = await page.evaluate(pageFunction, ...pageArguments);
    result.returnValue = returnValue;
  })();

  let isClosing = false;
  try {
    await Promise.race([
      errorPromise,
      resultPromise.catch((e) => {
        if (isClosing) {
          return null;
        }
        return Promise.reject(e);
      }),
    ]);
    return result;
  } finally {
    page.off("console", consoleCallback);
  }
};
