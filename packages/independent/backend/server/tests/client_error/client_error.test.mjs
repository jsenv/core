import { writeFileStructureSync, writeFileSync } from "@jsenv/filesystem";
import { chromium } from "playwright";

if (process.platform === "win32") {
  // disable on windows because it would fails due to line endings (CRLF)
  process.exit(0);
}

writeFileStructureSync(new URL("./output/screenshots/", import.meta.url), {});

let debug = false;
const { server } = await import("./start_server.mjs");
const browser = await chromium.launch({ headless: !debug });
const page = await browser.newPage();
try {
  await page.goto(`${server.origin}/public/index.html`);
} catch (e) {
  throw new Error(`error while loading page: ${e.stack}`);
}
await page.setViewportSize({ width: 900, height: 550 }); // generate smaller screenshots

let index = 0;
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
    new URL(`./output/screenshots/${index}_${scenario}.png`, import.meta.url),
    sceenshotBuffer,
  );
  index++;
};

await takeSnapshotsForScenario("no_route_matching", {
  resource: "/404",
});
await takeSnapshotsForScenario("no_route_matching_accept_text", {
  resource: "/404",
  headers: {
    accept: "text/plain",
  },
});
await takeSnapshotsForScenario("file_not_found", {
  resource: "/public/404",
});
await takeSnapshotsForScenario("file_not_found_accept_text", {
  resource: "/public/404",
  headers: {
    accept: "text/plain",
  },
});
await takeSnapshotsForScenario("json_accept_text", {
  resource: "/api/data.json",
});
await takeSnapshotsForScenario("json_accept_html", {
  resource: "/api/data.json",
  headers: {
    accept: "text/html",
  },
});

if (!debug) {
  await page.close();
  await browser.close();
  await server.stop();
}
