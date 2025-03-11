// this file launches a webkit browser, useful to test if dev server works on wekbit

import { chromium } from "playwright";

const browser = await chromium.launch({
  channel: "chrome", // https://github.com/microsoft/playwright/issues/7716#issuecomment-882634893
  // needed because https-localhost fails to trust cert on chrome + linux (ubuntu 20.04)
  args: ["--ignore-certificate-errors"],
  headless: false,
});
const browserContext = await browser.newContext({ ignoreHTTPSErrors: true });
await browserContext.newPage();
