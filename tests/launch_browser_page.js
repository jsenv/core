export const launchBrowserPage = async (
  browser,
  { mirrorConsole, pageErrorEffect = "throw" } = {},
) => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const browserName = browser._name;
  page.on("console", (message) => {
    const messageType = message.type();
    if (messageType === "error") {
      console.error(`${browserName} console.error > ${message.text()}`);
    } else if (mirrorConsole) {
      console.log(`${browserName} console.${messageType} > ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    if (pageErrorEffect === "throw") {
      throw error;
    }
    if (pageErrorEffect === "log") {
      console.error(error);
    }
  });
  return page;
};
