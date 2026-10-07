// eight pages, each scrolled through, reloaded, and waited on
"jsenv:allocate 120s";

/*
 * A list reloaded where it was left: it comes back on the same item, asking
 * only for what it draws.
 *
 * Reported from an application: reloading a page whose `<List.Items>` had
 * been scrolled down froze the tab. The list held on the item it was left at
 * found that item in the first answer before it had heard how many items there
 * were, aimed its window past the end it still believed in, was framed back,
 * and aimed again at every render.
 *
 * Once that was fixed, the list still asked for a page it was leaving: drawn
 * at the top while it waited, it asked for the top before moving to the item.
 *
 * Reloaded at the end of the collection and in its middle, for each thing the
 * run can know when it mounts — nothing, its count, the page kept by the
 * document before. What it holds: the list comes back on the item and offset it
 * was left at, and every range asked for is drawn. What it shows as it is: a
 * list opening near the end without its count asks twice (the first answer is
 * the one saying where the end is), and in the middle the window, sized once
 * the first picture is painted, reaches past the first page by a few items.
 */

import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { snapshotTests } from "@jsenv/snapshot";
import { chromium } from "playwright";

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: import.meta.resolve("../../"),
  keepProcessAlive: false,
  clientAutoreload: false,
  http2: false,
  port: 0,
  plugins: [jsenvPluginPreact()],
});

const browser = await chromium.launch({ headless: true });

// The dev server fills its own cache directory while cooking the page; those
// files are not what this test is about.
snapshotTests.prefConfigure({
  filesystemActions: {
    "**/.jsenv/": "ignore",
  },
});

const SETUPS = {
  knowing_nothing: "",
  knowing_its_count: "count=1",
  page_kept: "keep=1",
};

/* eslint-disable no-undef */
// The first item whole below the sticky header, and how far below it. An item
// the list opens on stands past the scroller's scroll-padding (8px here).
const readPlace = () => {
  const headerBottom = document
    .querySelector("#authors_header")
    .getBoundingClientRect().bottom;
  const items = [...document.querySelectorAll("[navi-list-item-real]")];
  const item = items.find(
    (candidate) => candidate.getBoundingClientRect().top > headerBottom - 0.5,
  );
  if (!item) {
    return "nothing drawn";
  }
  const offset = Math.round(item.getBoundingClientRect().top - headerBottom);
  return `${item.getAttribute("navi-list-item-real")} at ${offset}px`;
};
/* eslint-enable no-undef */

// A frozen tab answers no evaluate: given a few seconds, then called frozen.
const evaluateUnlessFrozen = (page, fn) =>
  Promise.race([
    page.evaluate(fn),
    new Promise((resolve) => setTimeout(() => resolve("frozen"), 4000)),
  ]);

const openPage = async (query) => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `${devServer.origin}/tests/list_reload_held_on_an_item/client/main.html?${query}`,
  );
  await page.waitForSelector("[navi-list-item-real]");
  await page.waitForTimeout(500);
  return { page, errors };
};

const scrollTo = async (page, where) => {
  if (where === "end") {
    // The end moves as pages land and rows take their real height: written
    // again until it holds still.
    let previous = -1;
    let still = 0;
    while (still < 3) {
      const top = await page.evaluate(() => {
        const scroller = document.querySelector("#scroller"); // eslint-disable-line no-undef
        scroller.scrollTop = scroller.scrollHeight;
        return scroller.scrollTop;
      });
      still = top === previous ? still + 1 : 0;
      previous = top;
      await page.waitForTimeout(150);
    }
  } else {
    await page.evaluate((top) => {
      document.querySelector("#scroller").scrollTop = top; // eslint-disable-line no-undef
    }, where);
  }
  // Long enough for the position to be written down and the pages to land.
  await page.waitForTimeout(1000);
};

const leaveThenReload = async (query, where) => {
  const { page, errors } = await openPage(query);
  try {
    await scrollTo(page, where);
    const leftOn = await page.evaluate(readPlace);
    await page.reload();
    await page.waitForTimeout(1500);
    const backOn = await evaluateUnlessFrozen(page, readPlace);
    const asked =
      backOn === "frozen"
        ? "frozen"
        : await page.evaluate(() => window.asks.join(", ")); // eslint-disable-line no-undef
    return { left_on: leftOn, back_on: backOn, asked, errors };
  } finally {
    await page.close({ runBeforeUnload: false });
  }
};

const reloadEverySetup = async (where) => {
  const result = {};
  for (const [name, query] of Object.entries(SETUPS)) {
    result[name] = await leaveThenReload(query, where);
  }
  return result;
};

const openOn = async (index) => {
  const result = {};
  for (const name of ["knowing_nothing", "knowing_its_count"]) {
    const { page, errors } = await openPage(`${SETUPS[name]}&open=${index}`);
    try {
      await page.waitForTimeout(1000);
      result[name] = {
        opens_on: await page.evaluate(readPlace),
        asked: await page.evaluate(() => window.asks.join(", ")), // eslint-disable-line no-undef
        errors,
      };
    } finally {
      await page.close();
    }
  }
  return result;
};

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    test("left at the end, reloaded", () => reloadEverySetup("end"));
    test("left in the middle, reloaded", () => reloadEverySetup(9000));
    test("opened on an item never drawn", () => openOn(300));
  });
} finally {
  await browser.close();
  devServer.stop();
}
