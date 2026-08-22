/*
 * Coming back to a list: who decides that it asks the server again.
 *
 * The answer belongs to the SOURCE the list reads through, and to nothing else
 * — not to the back button, and above all not to the movement playing between
 * the two pages. A relation is a statement about the app's map; it must not
 * also decide what the page arriving is allowed to do.
 *
 * The regression this holds was reported from an application: a list stopped
 * asking again on the way back as soon as `defineRouteTransition` was written
 * for the pair it was walked through. The app is mounted twice here, in the
 * shape such a transition is defined in (pages between fixed bars, a marked
 * area, a `Loading` boundary, a list long enough to hold rows it does not
 * draw), and the two mounts differ by that one line.
 *
 * What each way of reading answers, on the way back:
 * - `routeAction` + `GET_MANY` — nothing goes out: the action holds its
 *   response, and a page wanting fresh rows says `.rerun()` (see
 *   docs/list_refresh.md).
 * - `<List.Items>` + `GET_RANGE` — one ask goes out: the reader kept the
 *   composition, not the rows, and the window it draws is read again while the
 *   ranks from before stay on screen.
 * Both numbers must be the same with and without the movement.
 */

import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { snapshotTests } from "@jsenv/snapshot";
import { chromium } from "playwright";

const clientDirectoryUrl = import.meta.resolve("./client/");
// Every url the app routes to is served the app's html, the way a real server
// serving a single page application does.
const jsenvPluginRouteFallback = () => {
  return {
    name: "list_revisit_fallback",
    redirectReference: (reference) => {
      if (reference.isInline || !reference.url.startsWith("file:")) {
        return null;
      }
      const { pathname, search } = new URL(reference.url);
      for (const name of ["plain", "animated", "plain_wm", "animated_wm"]) {
        if (pathname.includes(`/client/${name}/item/`)) {
          return `${clientDirectoryUrl}${name}/${name}.html${search}`;
        }
      }
      return null;
    },
  };
};

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: import.meta.resolve("../../"),
  keepProcessAlive: false,
  clientAutoreload: false,
  http2: false,
  port: 0,
  plugins: [jsenvPluginPreact(), jsenvPluginRouteFallback()],
});

const browser = await chromium.launch({ headless: true });

// The movement is what the two mounts differ by, so a mount that played none
// would make the comparison say nothing: the attribute worn by the root for
// the length of a transition is watched, and counted.
const watchTransitions = (page) =>
  page.addInitScript(() => {
    /* eslint-disable no-undef */
    window.transitionsPlayed = 0;
    document.addEventListener("DOMContentLoaded", () => {
      new MutationObserver(() => {
        if (
          document.documentElement.hasAttribute("data-navi-route-transition")
        ) {
          window.transitionsPlayed++;
        }
      }).observe(document.documentElement, { attributes: true });
    });
    /* eslint-enable no-undef */
  });

const readAsks = (page) =>
  page.evaluate(() => {
    /* eslint-disable no-undef */
    return {
      range_asks: window.rangeCalls.length,
      many_asks: window.manyCalls.length,
    };
    /* eslint-enable no-undef */
  });
// The transition runs 300ms; the ask that a revalidation sends is looked for
// well past it, so "not yet" and "never" cannot be read as the same thing.
const settle = (page) => page.waitForTimeout(1500);
// Nothing is measured on the page opened on the way out — only the movement
// has to have played out before the way back begins.
const settleLeaving = (page) => page.waitForTimeout(400);

// One comparison decides nothing about a failure that comes and goes: a
// difference that shows up three times out of four passes a single run a
// quarter of the time. The way back is therefore walked REPEATEDLY, and what
// the snapshot holds is the whole sequence — "1111111111" says the re-read
// went out on every one of ten revisits, and any other string is a race caught
// in the act rather than a coin toss that landed well.
const CYCLES = 10;
// Both decors name the row that opens the detail page the same way.
const OPEN_ROW = "[data-testid=item_open]";

const openAndComeBack = async (name, search = "") => {
  const page = await browser.newPage();
  await watchTransitions(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(
      `${devServer.origin}/tests/route_transition_list_revisit/client/${name}/${name}.html${search}`,
    );
    await page.waitForSelector(OPEN_ROW);
    await settle(page);
    const onFirstLoad = await readAsks(page);
    const revisits = [];
    let cycle = 0;
    while (cycle < CYCLES) {
      const before = await readAsks(page);
      await page.locator(OPEN_ROW).first().click();
      await page.waitForSelector("#item_page");
      await settleLeaving(page);
      await page.goBack();
      await page.waitForSelector(OPEN_ROW);
      await settle(page);
      const after = await readAsks(page);
      revisits.push({
        range: after.range_asks - before.range_asks,
        many: after.many_asks - before.many_asks,
        rows: await page.locator(OPEN_ROW).count(),
      });
      cycle++;
    }
    return {
      on_first_load: onFirstLoad,
      // One digit per revisit, in order.
      range_asked_on_each_revisit: revisits.map((r) => r.range).join(""),
      many_asked_on_each_revisit: revisits.map((r) => r.many).join(""),
      // The rows are drawn every time, whatever the ask did: a page coming
      // back empty and a page coming back stale are not the same failure.
      rows_drawn_on_each_revisit: revisits.map((r) => r.rows).join(","),
      transitions_played: await page.evaluate(
        () => window.transitionsPlayed, // eslint-disable-line no-undef
      ),
      transition_left_on_root: await page.evaluate(() =>
        // eslint-disable-next-line no-undef
        document.documentElement.hasAttribute("data-navi-route-transition"),
      ),
      errors,
    };
  } finally {
    await page.close();
  }
};

// The dev server fills its own cache directory while cooking the pages; those
// hundreds of files are not what this test is about.
snapshotTests.prefConfigure({
  filesystemActions: {
    "**/.jsenv/": "ignore",
  },
});

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    test("a list revisited ten times, with and without a movement on the pair", async () => {
      return {
        without_transition: await openAndComeBack("plain"),
        with_transition: await openAndComeBack("animated"),
      };
    });

    // The same walk on a list held on a row the URL names: the window it comes
    // back to is decided in the same frames as the re-read, which is where a
    // hold and an ask can pass each other.
    test("a list held on a row named by the url, revisited ten times", async () => {
      return {
        without_transition: await openAndComeBack("plain", "?at=item_400"),
        with_transition: await openAndComeBack("animated", "?at=item_400"),
      };
    });

    // The opposite decor, and the one a report came from: ONE row, the page as
    // the scroller, the list opening on its last rows, and a count known from
    // elsewhere before any row is drawn. Nothing is virtualized away here — no
    // window ever has to move — which exercises the other half of the run.
    test("a one-row list against the document scroller, revisited ten times", async () => {
      return {
        without_transition: await openAndComeBack("plain_wm"),
        with_transition: await openAndComeBack("animated_wm"),
      };
    });
  });
} finally {
  await browser.close();
  devServer.stop();
}
