// eight pages, each scrolled through, reloaded, and waited on
"jsenv:allocate 300s";

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

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  startNaviDevServer,
} from "../browser_harness.mjs";

const devServer = await startNaviDevServer();
configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();
const pageUrlOf = (query) =>
  `${devServer.origin}/tests/list_reload_held_on_an_item/client/main.html?${query}`;

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

const openPage = async (browser, query, { initScript } = {}) => {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  if (initScript) {
    await page.addInitScript(initScript.fn, initScript.arg);
  }
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // The run's budget ("jsenv:allocate") is the limit: under a full test run the
  // first load, which cooks all of navi, outlasts Playwright's 30s.
  await page.goto(pageUrlOf(query), { timeout: 0 });
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

const leaveThenReload = async (browser, query, where) => {
  const { page, errors } = await openPage(browser, query);
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

const reloadEverySetup = async (browser, where) => {
  const result = {};
  for (const [name, query] of Object.entries(SETUPS)) {
    result[name] = await leaveThenReload(browser, query, where);
  }
  return result;
};

// A tab the system discards in the background never fires pagehide: what it
// keeps of its positions is written when it goes to the background, and the
// document opened when the reader comes back is a return (wasDiscarded). The
// discarded tab is played as a new document given the session storage the
// first one left, and `document.wasDiscarded`.
/* eslint-disable no-undef */
const readKeptPositions = () => {
  const stored = sessionStorage.getItem("navi_scroll_positions");
  if (!stored) {
    return "nothing kept";
  }
  const { scrollers } = JSON.parse(stored);
  const kept = Object.values(scrollers || {})
    .map((byName) => byName.author_list)
    .filter(Boolean)
    .map((position) => position.id);
  return kept.length ? kept.join(", ") : "nothing kept";
};
const goToTheBackground = () => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "hidden",
  });
  document.dispatchEvent(new Event("visibilitychange"));
};
const comeBackDiscarded = (storage) => {
  for (const [key, value] of Object.entries(storage)) {
    sessionStorage.setItem(key, value);
  }
  Object.defineProperty(Document.prototype, "wasDiscarded", {
    configurable: true,
    get: () => true,
  });
};
/* eslint-enable no-undef */
const discardInTheBackground = async (browser, where) => {
  const { page, errors } = await openPage(browser, SETUPS.knowing_nothing);
  let storage;
  let result;
  try {
    await scrollTo(page, where);
    const leftOn = await page.evaluate(readPlace);
    const keptBeforeBackground = await page.evaluate(readKeptPositions);
    await page.evaluate(goToTheBackground);
    const keptInTheBackground = await page.evaluate(readKeptPositions);
    storage = await page.evaluate(() => ({ ...sessionStorage }));
    result = {
      left_on: leftOn,
      kept_before_the_background: keptBeforeBackground,
      kept_in_the_background: keptInTheBackground,
    };
  } finally {
    await page.close({ runBeforeUnload: false });
  }
  const comeBack = await openPage(browser, SETUPS.knowing_nothing, {
    initScript: { fn: comeBackDiscarded, arg: storage },
  });
  try {
    await comeBack.page.waitForTimeout(1500);
    return {
      ...result,
      back_on: await comeBack.page.evaluate(readPlace),
      errors: [...errors, ...comeBack.errors],
    };
  } finally {
    await comeBack.page.close();
  }
};

const openOn = async (browser, index) => {
  const result = {};
  for (const name of ["knowing_nothing", "knowing_its_count"]) {
    const { page, errors } = await openPage(
      browser,
      `${SETUPS[name]}&open=${index}`,
    );
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
    testInEngines(test, "left at the end, reloaded", ({ browser }) =>
      reloadEverySetup(browser, "end"),
    );
    testInEngines(test, "left in the middle, reloaded", ({ browser }) =>
      reloadEverySetup(browser, 9000),
    );
    testInEngines(test, "opened on an item never drawn", ({ browser }) =>
      openOn(browser, 300),
    );
    testInEngines(
      test,
      "left in the middle, the tab discarded in the background",
      ({ browser }) => discardInTheBackground(browser, 9000),
    );
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
