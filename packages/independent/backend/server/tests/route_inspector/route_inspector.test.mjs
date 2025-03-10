import { writeFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

if (process.platform === "win32") {
  // disable on windows because it would fails due to line endings (CRLF)
  process.exit(0);
}

writeFileStructureSync(new URL("./output/screenshots/", import.meta.url), {});

let debug = false;
const { server } = await import("./route_inspector_start_server.mjs");
const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage();
try {
  await page.goto(`${server.origin}`);
} catch (e) {
  throw new Error(`error while loading page: ${e.stack}`);
}
await page.setViewportSize({ width: 900, height: 900 }); // generate smaller screenshots

let index = 0;
const takeSnapshotsForScenario = async (scenario) => {
  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./output/screenshots/${index}_${scenario}.png`, import.meta.url),
    sceenshotBuffer,
  );
  index++;
};

await takeSnapshotsForScenario("no_route_matching");
await page.click('a[href="/.internal/route_inspector"]');
await takeSnapshotsForScenario("after_click_route_inspector");

if (!debug) {
  await page.close();
  await browser.close();
  await server.stop();
}
