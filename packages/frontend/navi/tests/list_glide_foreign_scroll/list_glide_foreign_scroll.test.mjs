/*
 * A list gliding to an item (--navi-scroll:smooth) writes the scroll at every
 * frame. A scroll that comes with no input event — the page's own scrollTo,
 * the status bar tapped on iOS, a scrollbar dragged in Firefox, find in page —
 * is not the glide's: the glide stops there and the list is the reader's.
 * Overwritten, it was lost, and the list landed on the item all the same.
 * Uninterrupted, the glide still lands on the item.
 */

"jsenv:allocate 60s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage,
  startNaviDevServer,
  waitFrames,
} from "../browser_harness.mjs";

const devServer = await startNaviDevServer();
const pageUrl = `${devServer.origin}/tests/list_glide_foreign_scroll/client/main.html`;

/* eslint-disable no-undef */
const readEnd = (page) =>
  page.evaluate(() => {
    const item = [...document.querySelectorAll("[navi-list-item-real]")].find(
      (itemEl) => itemEl.textContent === "item 1200",
    );
    const scrollerTop =
      window.scrollerEl() === document.scrollingElement
        ? 0
        : window.scrollerEl().getBoundingClientRect().top;
    return {
      scroll_at_start: Math.round(window.scrollerEl().scrollTop) === 0,
      item_1200_at_top: item
        ? Math.round(item.getBoundingClientRect().top - scrollerTop) === 0
        : false,
    };
  });
/* eslint-enable no-undef */

configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    for (const scroller of ["document", "self"]) {
      testInEngines(
        test,
        `glide to item 1200 (${scroller})`,
        async ({ browser }) => {
          const { page, errors, warnings } = await openPage(
            browser,
            `${pageUrl}?scroller=${scroller}`,
            { viewport: { width: 390, height: 844 } },
          );
          try {
            await page.waitForSelector("[navi-list-item-real]");
            await page.click("#glide");
            await waitFrames(page, 120);
            return { ...(await readEnd(page)), errors, warnings };
          } finally {
            await page.close();
          }
        },
      );

      testInEngines(
        test,
        `glide interrupted by the page writing the scroll (${scroller})`,
        async ({ browser }) => {
          const { page, errors, warnings } = await openPage(
            browser,
            `${pageUrl}?scroller=${scroller}`,
            { viewport: { width: 390, height: 844 } },
          );
          try {
            await page.waitForSelector("[navi-list-item-real]");
            await page.click("#glide");
            // on its way, then moved by the page itself
            await page.waitForFunction(
              () => window.scrollerEl().scrollTop > 2000, // eslint-disable-line no-undef
            );
            await page.evaluate(() => {
              window.scrollerEl().scrollTop = 0; // eslint-disable-line no-undef
            });
            await waitFrames(page, 120);
            return { ...(await readEnd(page)), errors, warnings };
          } finally {
            await page.close();
          }
        },
      );
    }
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
