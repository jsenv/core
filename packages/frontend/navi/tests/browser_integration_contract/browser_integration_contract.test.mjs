/*
 * The contract between navi and the browser's history, run on both of navi's
 * integrations: via_history.js (what every browser gets today) and
 * via_navigation.js (the Navigation API, meant to take over). The same presses,
 * in the same order, on the same app; after each one, what the history holds —
 * the address, the number of entries, navi's depth — whether a sheet kept in
 * the entry is open, and how many navigations were announced (the rendering
 * hold and route transitions listen to those).
 *
 * Each sequence lists the steps where the two integrations differ: none is the
 * contract held. A difference is a decision to take, not a snapshot to accept.
 * WebKit without the Navigation API falls back to history (`integration`).
 */

"jsenv:allocate 240s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage,
  startNaviDevServer,
  whenPageAtRest,
} from "../browser_harness.mjs";

// Every address of the app is served its html, as a single page application's
// server does: client/history/ runs the app on via_history.js, client/navigation/
// calls enableNavigationApi() before it.
const jsenvPluginRouteFallback = () => ({
  name: "integration_contract_fallback",
  redirectReference: (reference) => {
    if (reference.isInline || !reference.url.startsWith("file:")) {
      return null;
    }
    const { pathname, search } = new URL(reference.url);
    for (const integration of ["history", "navigation"]) {
      for (const page of ["", "a", "b", "to_home"]) {
        if (
          pathname.endsWith(
            `/tests/browser_integration_contract/client/${integration}/${page}`,
          )
        ) {
          return `${import.meta.resolve(`./client/${integration}/index.html`)}${search}`;
        }
      }
    }
    return null;
  },
});

const devServer = await startNaviDevServer({
  plugins: [jsenvPluginRouteFallback()],
});
configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

/* eslint-disable no-undef */
const readHistory = () => ({
  path: window.location.pathname.replace(/^.*\/client\/[a-z]+\//, "/"),
  search: window.location.search,
  hash: window.location.hash,
  entries: history.length,
  depth: window.readNavDepth(),
  sheet_open: Boolean(document.querySelector("#sheet")),
  announced: `${window.announced.before} before / ${window.announced.after} after`,
});
/* eslint-enable no-undef */

// A step is a press or a call; what it leaves is read once the page is at rest
// — a traversal is answered by the browser a task later, hence the short wait
// before asking.
const settle = async (page) => {
  await page.waitForTimeout(150);
  await whenPageAtRest(page);
};
const click = (selector) => async (page) => {
  await page.click(selector);
};
const evaluate = (fn) => async (page) => {
  await page.evaluate(fn);
};
/* eslint-disable no-undef */
const back = evaluate(() => history.back());
const forward = evaluate(() => history.forward());
const reloadRoutes = evaluate(() => window.reloadRoutes());
/* eslint-enable no-undef */

const SEQUENCES = {
  "push, push, back, forward": [
    ["press a", click("#link_a")],
    ["press b", click("#link_b")],
    ["back", back],
    ["forward", forward],
  ],
  "a push to the entry next door": [
    ["press a", click("#link_a")],
    ["back", back],
    ["press a again", click("#link_a")],
  ],
  "a replace": [["press b (replace)", click("#link_b_replace")]],
  "a press redirected to the address on display": [
    ["press to_home", click("#link_to_home")],
  ],
  "a press its ancestor cancels": [
    ["press b, cancelled", click("#link_b_cancelled")],
  ],
  "a sheet kept in the entry": [
    ["open the sheet", click("#open_sheet")],
    ["back", back],
    ["open the sheet again", click("#open_sheet")],
    ["confirm", click("#confirm_sheet")],
  ],
  "a fragment of the page": [
    ["press #section", click("#link_fragment")],
    ["back", back],
  ],
  "routes reloaded": [["reload()", reloadRoutes]],
  // The address follows a typed search late; a press made meanwhile stacks
  // on the address the document is at, the search included.
  // navi's own back and forward leave an entry carrying what was typed there.
  "navBack while a typed search is not yet in the address": [
    ["press b", click("#link_b")],
    ["press a", click("#link_a")],
    // not the entry next door: a push
    ["press home", click("#link_home")],
    [
      "type, then navBack at once",
      async (page) => {
        /* eslint-disable no-undef */
        await page.evaluate(() => {
          window.typeSearch("club");
          window.navBack();
        });
        /* eslint-enable no-undef */
      },
    ],
    ["forward", forward],
  ],
  "a press while a typed search is not yet in the address": [
    [
      "type, then press a at once",
      async (page) => {
        // eslint-disable-next-line no-undef
        await page.evaluate(() => window.typeSearch("padel"));
        await page.click("#link_a");
      },
    ],
    ["back", back],
  ],
};

// Opened on the home page's own address, so that a press redirected to home
// is a press redirected to the address on display.
const play = async (browser, integration, steps) => {
  const { page, errors } = await openPage(
    browser,
    `${devServer.origin}/tests/browser_integration_contract/client/${integration}/`,
  );
  try {
    await settle(page);
    const timeline = [
      {
        step: "loaded",
        integration: await page.evaluate(() => window.integration), // eslint-disable-line no-undef
        ...(await page.evaluate(readHistory)),
      },
    ];
    for (const [name, run] of steps) {
      try {
        await run(page);
        await settle(page);
        timeline.push({ step: name, ...(await page.evaluate(readHistory)) });
      } catch {
        // The press took the tab out of the app: nothing more to read.
        timeline.push({ step: name, left_the_document: page.url() });
        break;
      }
    }
    return { timeline, errors };
  } finally {
    await page.close();
  }
};

const compare = async (browser, steps) => {
  const viaHistory = await play(browser, "history", steps);
  const viaNavigation = await play(browser, "navigation", steps);
  const differs = [];
  const withoutIntegration = (entry) => {
    if (!entry) {
      return null;
    }
    const copy = { ...entry };
    delete copy.integration;
    return JSON.stringify(copy);
  };
  viaHistory.timeline.forEach((entry, index) => {
    if (
      withoutIntegration(entry) !==
      withoutIntegration(viaNavigation.timeline[index])
    ) {
      differs.push(entry.step);
    }
  });
  return {
    steps_where_they_differ: differs,
    via_history: viaHistory,
    via_navigation: viaNavigation,
  };
};

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    for (const [name, steps] of Object.entries(SEQUENCES)) {
      testInEngines(test, name, ({ browser }) => compare(browser, steps));
    }
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
