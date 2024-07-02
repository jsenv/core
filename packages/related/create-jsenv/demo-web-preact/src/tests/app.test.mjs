import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

const browser = await chromium.launch();

try {
  const browserContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await browserContext.newPage();
  await page.goto(`http://localhost:3400`);

  const getCounterOutput = () => {
    return page.locator("#counter_output").innerHTML();
  };

  assert({
    actual: await getCounterOutput(),
    expect: "0",
  });
  await page.locator("#counter_button").click();
  assert({
    actual: await getCounterOutput(),
    expect: "1",
  });
} finally {
  browser.close();
}
