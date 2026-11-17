"jsenv:allocate 60s";

/*
 * A list judges its geometry on the list it is: whole from its first commit,
 * and judged again when it resizes.
 *
 * Which box scrolls a list given no height of its own is measured (see
 * getScrollerEl): its own box while the list fits the screen, the box around
 * it once it stands taller. Reported from an application: coming back to a
 * page of 112 members, the window raised "ResizeObserver loop completed with
 * undelivered notifications". The list was measured in commits where it stood
 * at the height of the 14 rows it draws — shorter than the screen, by a few
 * pixels — before its fillers held the room of the other 98: it took its own
 * box for the one that scrolls it, and switched to the page's from inside a
 * ResizeObserver delivery, where the page's box observed anew is skipped. The
 * same commits drew the empty message for one commit before the rows were
 * declared, and the dev warning for a list whose window cannot move fired on
 * every visit.
 *
 * What it holds:
 * - At the end of its first commit, a list holds the room of the rows it does
 *   not draw, and draws the empty message only when it has no rows.
 * - The report's list, mounted whole, never has to change box. The change
 *   itself is made here on purpose: a list outgrowing the screen, then fitting
 *   it again, from a resize alone — no commit of the list in between.
 * - Nothing reaches the window, and no dev warning fires, in any of it.
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

const open = async (search) => {
  // A phone's screen, where 14 rows of 58px stand 32px short of it.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const warnings = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      warnings.push(message.text());
    }
  });
  // The run's budget ("jsenv:allocate") is the limit: under a full test run
  // the first load, which cooks all of navi, outlasts Playwright's 30s.
  await page.goto(
    `${devServer.origin}/tests/list_mount_geometry/client/main.html${search}`,
    { timeout: 0 },
  );
  await page.waitForFunction(() => window.firstCommit, null, { timeout: 0 }); // eslint-disable-line no-undef
  await settle(page);
  return { page, warnings };
};
// Long enough for what a commit causes to land: the frames after it, the
// resizes they deliver, the commits those cause.
const settle = (page) => page.evaluate(() => window.waitFrames(10)); // eslint-disable-line no-undef

const readMount = async (search) => {
  const { page, warnings } = await open(search);
  try {
    return {
      first_commit: await page.evaluate(() => window.firstCommit), // eslint-disable-line no-undef
      settled: await page.evaluate(() => window.readList()), // eslint-disable-line no-undef
      page_scrolled: await page.evaluate(() => Math.round(window.scrollY)), // eslint-disable-line no-undef
      top_row: await page.evaluate(() => window.readTopRow()), // eslint-disable-line no-undef
      errors: await page.evaluate(() => window.errors), // eslint-disable-line no-undef
      warnings,
    };
  } finally {
    await page.close();
  }
};

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    test("a long list scrolling the page", async () => {
      return await readMount("?case=long");
    });

    // Where the report's list was when it raised the error: coming back to a
    // row far down, the page scrolled thousands of pixels.
    test("the same list opening on a row far down", async () => {
      return await readMount("?case=long&open=member_80");
    });

    test("an empty list", async () => {
      return await readMount("?case=empty");
    });

    test("a list outgrowing the screen, then fitting it again", async () => {
      const { page, warnings } = await open("?case=grow");
      try {
        const readPage = () =>
          page.evaluate(() => ({
            /* eslint-disable no-undef */
            list_height: window.readList().height,
            page_scrolls:
              document.scrollingElement.scrollHeight > window.innerHeight,
            /* eslint-enable no-undef */
          }));
        const fitting = await readPage();
        await page.evaluate(() => window.grow(1200)); // eslint-disable-line no-undef
        await settle(page);
        const outgrown = await readPage();
        await page.evaluate(() => window.grow(0)); // eslint-disable-line no-undef
        await settle(page);
        const fittingAgain = await readPage();
        return {
          fitting,
          outgrown,
          fitting_again: fittingAgain,
          errors: await page.evaluate(() => window.errors), // eslint-disable-line no-undef
          warnings,
        };
      } finally {
        await page.close();
      }
    });
  });
} finally {
  await browser.close();
  devServer.stop();
}
