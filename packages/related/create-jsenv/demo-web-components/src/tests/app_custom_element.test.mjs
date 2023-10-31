import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

const browser = await chromium.launch();

try {
  const browserContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await browserContext.newPage();
  await page.goto(`http://localhost:3400`);

  const actual = true;
  const expected = true;
  assert({ actual, expected });
} finally {
  browser.close();
}
