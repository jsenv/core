/*
 * The way back asked before the movement it undoes has shown anything: no
 * picture is moving yet, and the reader still sees the page the way back
 * returns to. Nothing moves: the movement is dropped and the way back plays
 * none of its own. One of its own photographed the page being left on both
 * sides (still held, or the page arriving that nobody saw) and slid it onto
 * the page on screen (AN-173).
 *
 * Two moments:
 * - asked in the same task as the press, before the browser takes any picture;
 * - asked while the browser waits for the page arriving to render, the page
 *   being left frozen on screen (the update callback held, see main.jsx).
 */

"jsenv:allocate 60s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage,
  startNaviDevServer,
  whenPageAtRest,
} from "../browser_harness.mjs";

const devServer = await startNaviDevServer();
const pageUrl = `${devServer.origin}/tests/route_transition_way_back_before_pictures/client/main.html`;

/* eslint-disable no-undef */
const openHome = async (browser) => {
  const opened = await openPage(browser, pageUrl);
  const { page } = opened;
  await whenPageAtRest(page);
  // the address as the home route writes it, which the way back returns to
  await page.evaluate(() => window.goHome({ replace: true }));
  await whenPageAtRest(page);
  await page.evaluate(() => {
    window.movements = [];
    window.viewTransitions = [];
  });
  return opened;
};
const readLanding = async (page) => {
  await page.waitForSelector(".home_page");
  await whenPageAtRest(page);
  return page.evaluate(() => ({
    movements: window.movements,
    view_transitions: window.viewTransitions.map(({ played }) =>
      played ? "played" : "dropped",
    ),
    pages_on_screen: [...document.querySelectorAll(".home_page, .detail_page")]
      .filter((pageEl) => !pageEl.closest("[data-navi-route-leaving]"))
      .map((pageEl) => pageEl.className),
    transition_attributes_left: [...document.documentElement.attributes]
      .map((attribute) => attribute.name)
      .filter((name) => name.startsWith("data-navi-route-transition")),
  }));
};
/* eslint-enable no-undef */

configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    testInEngines(
      test,
      "way back asked in the same task as the press",
      async ({ browser }) => {
        const { page, errors, warnings } = await openHome(browser);
        try {
          await page.evaluate(() => {
            /* eslint-disable no-undef */
            window.goDetail();
            window.goHome();
            /* eslint-enable no-undef */
          });
          return { ...(await readLanding(page)), errors, warnings };
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(
      test,
      "way back asked while the page arriving is awaited",
      async ({ browser }) => {
        const { page, errors, warnings } = await openHome(browser);
        try {
          await page.evaluate(() => {
            /* eslint-disable no-undef */
            window.holdCallbackMs = 400;
            window.goDetail();
            /* eslint-enable no-undef */
          });
          // Polled on a timer: the document is frozen, no frame comes.
          await page.waitForFunction(
            () => window.viewTransitions[0]?.awaitingPage, // eslint-disable-line no-undef
            null,
            { polling: 10 },
          );
          await page.evaluate(() => window.goHome()); // eslint-disable-line no-undef
          return { ...(await readLanding(page)), errors, warnings };
        } finally {
          await page.close();
        }
      },
    );
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
