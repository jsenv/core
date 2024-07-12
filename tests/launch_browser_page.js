export const launchBrowserPage = async (
  browser,
  { pageErrorEffect = "throw" } = {},
) => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (pageErrorEffect === "throw") {
      throw error;
    }
    console.error(error);
  });
  return page;
};
