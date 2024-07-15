export const launchBrowserPage = async (
  browser,
  { mirrorConsole, pageErrorEffect = "throw" } = {},
) => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(message.text());
    } else if (mirrorConsole) {
      console.log(message.text());
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
