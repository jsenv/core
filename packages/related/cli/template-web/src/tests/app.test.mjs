import { chromium } from "playwright";
import { assert } from "@jsenv/assert";

const browser = await chromium.launch();

try {
  const browserContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await browserContext.newPage();
  const getCounterOutput = () => {
    return page.locator("#counter_output").innerHTML();
  };
  await page.goto(`http://localhost:3400`);
  const counterAtStart = await getCounterOutput();
  await page.locator("#counter_button").click();
  const counterAfterClick = await getCounterOutput();
  assert({
    actual: {
      counterAtStart,
      counterAfterClick,
    },
    expect: {
      counterAtStart: "0",
      counterAfterClick: "1",
    },
  });
} finally {
  browser.close();
}
