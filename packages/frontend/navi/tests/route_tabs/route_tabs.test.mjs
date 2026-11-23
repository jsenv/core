/*
 * Navigating between tabs that live on a single route: the tab really changes,
 * and the page around it stays. Two regressions are covered here, both silent
 * (no error, nothing in the console) when they happen:
 * - the container keeps rendering the tab it picked on the first render,
 *   because its selection reads params it is not subscribed to;
 * - the whole subtree under <Loading> disappears when the route action of a tab
 *   has nothing to do, because an action with no params suspends forever.
 */

"jsenv:allocate 90s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  openPage as openHarnessPage,
  startNaviDevServer,
  whenPageAtRest,
} from "../browser_harness.mjs";

const clientHtmlFileUrl = import.meta.resolve("./client/route_tabs.html");
// Every url the app routes to is served the app's html, the way a real server
// serving a single page application does. Without it a direct load on a tab is
// a 404 and only client side navigation can be tested.
const jsenvPluginRouteFallback = () => {
  return {
    name: "route_tabs_fallback",
    redirectReference: (reference) => {
      if (reference.isInline || !reference.url.startsWith("file:")) {
        return null;
      }
      const { pathname, search } = new URL(reference.url);
      if (!pathname.includes("/tests/route_tabs/client/games/")) {
        return null;
      }
      return `${clientHtmlFileUrl}${search}`;
    },
  };
};

const devServer = await startNaviDevServer({
  plugins: [jsenvPluginRouteFallback()],
});
const pageUrl = `${devServer.origin}/tests/route_tabs/client/route_tabs.html`;

const readPage = (page) => {
  return page.evaluate(() => {
    /* eslint-disable no-undef */
    const sectionElement = document.querySelector("#section_body");
    return {
      pathname: window.location.pathname.slice(
        "/tests/route_tabs/client/".length,
      ),
      section: sectionElement ? sectionElement.textContent : null,
      top_bar: Boolean(document.querySelector("#top_bar")),
      bottom_bar: Boolean(document.querySelector("#bottom_bar")),
      app_is_empty: document.querySelector("#app").innerHTML === "",
    };
    /* eslint-enable no-undef */
  });
};
// What is snapshotted is the state the tab ends up in, once its action has
// answered and the page painted it, not a state on the way there.
const settle = (page) => whenPageAtRest(page);

const openPage = async (browser, url) => {
  const { page } = await openHarnessPage(browser, url);
  await settle(page);
  return page;
};
const clickTab = async (page, tabText) => {
  try {
    // Short timeout on purpose: when one of the regressions above is back the
    // tab is gone along with the rest of the page, and the snapshot must show
    // that state instead of waiting for the test to time out.
    await page.click(`a:has-text("${tabText}")`, { timeout: 2000 });
  } catch {
    return { tab_not_found: tabText, ...(await readPage(page)) };
  }
  await settle(page);
  return readPage(page);
};

configureBrowserSnapshots();
const { testInEngines, closeBrowsers } = createEngineTests();

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    testInEngines(
      test,
      "tab switching on a single route",
      async ({ browser }) => {
        const page = await openPage(browser, pageUrl);
        try {
          return {
            at_start: await readPage(page),
            // a tab whose action runs
            candidate: await clickTab(page, "candidate"),
            // the tab whose action has nothing to do: the page must stay
            done: await clickTab(page, "done"),
            // and back, to check the selection follows both ways
            to_come: await clickTab(page, "to_come"),
            candidate_again: await clickTab(page, "candidate"),
          };
        } finally {
          await page.close();
        }
      },
    );

    testInEngines(
      test,
      "direct load on a tab, then leaving and coming back",
      async ({ browser }) => {
        const page = await openPage(
          browser,
          `${devServer.origin}/tests/route_tabs/client/games/me/done`,
        );
        try {
          return {
            direct_load_done: await readPage(page),
            home: await clickTab(page, "home"),
            back_to_done: await clickTab(page, "done"),
          };
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
