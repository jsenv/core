/*
 * A RouteTravel row, pressed through its bar: where the live page stands once
 * the row rests (step 07).
 *
 * Reported twice from an application: a press on › then ‹ inside one glide
 * left the live page one column off the pane its address names, and the frame
 * was blank. The column is the render's (`--navi-route-row-column`) and a
 * movement only overrides it while it travels (`--navi-route-row-travel-column`):
 * at rest nothing of the movement is left — no override, no pictures, no
 * attribute saying the row travels or holds a pane — and the live page stands
 * in the column of the pane its address names, in the frame.
 *
 * Each walk ends on a press made after the row rested: it must move the row,
 * or something of the movement is still standing.
 */

"jsenv:allocate 120s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage,
  startNaviDevServer,
  whenPageAtRest,
} from "../browser_harness.mjs";

const clientHtmlFileUrl = import.meta.resolve("./client/main.html");
// Every /item/:id is served the app's html, as a single page application's
// server does.
const jsenvPluginRouteFallback = () => ({
  name: "route_travel_fallback",
  redirectReference: (reference) => {
    if (reference.isInline || !reference.url.startsWith("file:")) {
      return null;
    }
    const { pathname, search } = new URL(reference.url);
    if (!pathname.includes("/tests/route_travel/client/item/")) {
      return null;
    }
    return `${clientHtmlFileUrl}${search}`;
  },
});

const devServer = await startNaviDevServer({
  plugins: [jsenvPluginRouteFallback()],
});
configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

/* eslint-disable no-undef */
const readRow = () => {
  const row = document.querySelector("[data-route-travel-row]");
  const live = row.querySelector(":scope > [data-route-row-live]");
  const panes = [...row.querySelectorAll(":scope > [data-route-row-pane]")];
  const addressId = window.location.pathname.split("/item/")[1];
  const liveColumn = Number(getComputedStyle(live).gridColumnStart);
  // The window is the five pages around the address, clamped at the first:
  // the address's pane is the third, or the first or second near the start.
  const addressPaneColumn = Math.min(Number(addressId), 2) + 1;
  const rowRect = row.getBoundingClientRect();
  const liveRect = live.getBoundingClientRect();
  const overridden = [
    ...row.querySelectorAll("[style*='--navi-route-row-travel-column']"),
  ].length;
  const movementAttributes = [
    "data-route-row-travelling",
    "data-route-row-held",
    "data-route-row-holding",
    "data-route-row-taken",
  ].filter(
    (name) => row.hasAttribute(name) || row.querySelector(`[${name}]`) !== null,
  );
  return {
    address: `/item/${addressId}`,
    counter: document.querySelector("#counter").textContent,
    live_shows: live.textContent.slice(0, "Item 10".length).trim(),
    live_in_the_frame: Math.abs(liveRect.left - rowRect.left) < 1,
    panes: panes.length,
    live_column_is_the_address_pane: liveColumn === addressPaneColumn,
    travel_overrides_left: overridden,
    pictures_left: row.querySelector("[data-route-row-pictures]").children
      .length,
    movement_attributes_left: movementAttributes,
  };
};
/* eslint-enable no-undef */

// The row at rest: the address settled, the page at rest, and nothing of the
// movement left on the row — bounded, so a movement that never ends shows in
// the snapshot instead of hanging the run.
const rowAtRest = async (page) => {
  await whenPageAtRest(page);
  await page
    .waitForFunction(
      () =>
        // eslint-disable-next-line no-undef
        !document.querySelector(
          "[data-route-row-travelling], [data-route-row-taken]",
        ),
      null,
      { timeout: 4000 },
    )
    .catch(() => {});
  await page.waitForTimeout(100);
};

// Two presses, the second while the row is still gliding to the first.
const pressTwice = async (browser, first, second) => {
  const { page, errors } = await openPage(
    browser,
    `${devServer.origin}/tests/route_travel/client/item/5`,
    { viewport: { width: 400, height: 700 } },
  );
  try {
    await page.waitForSelector("[data-route-row-live]", { timeout: 0 });
    await rowAtRest(page);
    const at_start = await page.evaluate(readRow);
    await page.click(first);
    await page.waitForTimeout(80);
    await page.click(second);
    await rowAtRest(page);
    const at_rest = await page.evaluate(readRow);
    await page.click("#next");
    await rowAtRest(page);
    const after_one_more_press = await page.evaluate(readRow);
    return { at_start, at_rest, after_one_more_press, errors };
  } finally {
    await page.close();
  }
};

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    testInEngines(test, "› then ‹ inside one glide", ({ browser }) =>
      pressTwice(browser, "#next", "#previous"),
    );
    testInEngines(test, "› then › inside one glide", ({ browser }) =>
      pressTwice(browser, "#next", "#next"),
    );
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
