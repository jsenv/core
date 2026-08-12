/*
 * Navigating between tabs that live on a single route: the tab really changes,
 * and the page around it stays. Two regressions are covered here, both silent
 * (no error, nothing in the console) when they happen:
 * - the container keeps rendering the tab it picked on the first render,
 *   because its selection reads params it is not subscribed to;
 * - the whole subtree under <Loading> disappears when the route action of a tab
 *   has nothing to do, because an action with no params suspends forever.
 */

import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { snapshotTests } from "@jsenv/snapshot";
import { chromium } from "playwright";

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
const pageUrl = `${devServer.origin}/tests/route_tabs/client/route_tabs.html`;

const browser = await chromium.launch({ headless: true });

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
// The action resolves in 50ms; leave it room to settle so what is snapshotted
// is the state the tab ends up in, not a state on the way there.
const settle = (page) => page.waitForTimeout(300);

const openPage = async (url) => {
  const page = await browser.newPage();
  await page.goto(url);
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

// The dev server fills its own cache directory while cooking the page; those
// hundreds of files are not what this test is about.
snapshotTests.prefConfigure({
  filesystemActions: {
    "**/.jsenv/": "ignore",
  },
});

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    test("tab switching on a single route", async () => {
      const page = await openPage(pageUrl);
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
    });

    test("direct load on a tab, then leaving and coming back", async () => {
      const page = await openPage(
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
    });
  });
} finally {
  await browser.close();
  devServer.stop();
}
