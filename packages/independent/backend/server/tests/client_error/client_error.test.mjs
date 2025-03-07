import { writeFileSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

if (process.platform === "win32") {
  // disable on windows because it would fails due to line endings (CRLF)
  process.exit(0);
}

let debug = true;
const { server } = await import("./start_server.mjs");
const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage();
try {
  await page.goto(`${server.origin}/index.html`);
} catch (e) {
  throw new Error(`error while loading page: ${e.stack}`);
}
await page.setViewportSize({ width: 900, height: 550 }); // generate smaller screenshots

const takeSnapshotsForScenario = async (
  scenario,
  { resource, method = "GET", headers = {} },
) => {
  await page.evaluate(
    /* eslint-disable no-undef */
    async ({ resource, method, headers }) => {
      await window.fetchResourceAndDisplayResultInDocument({
        resource,
        method,
        headers,
      });
    },
    /* eslint-enable no-undef */
    { resource, method, headers },
  );

  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./output/screenshots/${scenario}.png`, import.meta.url),
    sceenshotBuffer,
  );

  // if (!process.env.CI && !process.env.JSENV) {
  //   console.log(`"${story}" snapshot generated for ${browserName}`);
  // }
};

await takeSnapshotsForScenario("0_404", {
  resource: "/404",
});

if (!debug) {
  await page.close();
  await browser.close();
}
