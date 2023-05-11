export const launchBrowserPage = async (browser) => {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  page.on("console", (message) => {
    if (message.type() === "error") {
      console.error(message.text());
    }
  });
  page.on("pageerror", (error) => {
    throw error;
  });
  return page;
};
