import { assert } from "@jsenv/assert";
import {
  createFileSystemFetch,
  ServerEvents,
  startServer,
} from "@jsenv/server";
import { chromium } from "playwright";

if (process.platform === "win32") {
  process.exit(0);
}

const serverEvents = new ServerEvents({
  // logLevel: "debug",
  maxClientAllowed: 1,
});
const server = await startServer({
  logLevel: "warn",
  keepProcessAlive: false,
  routes: [
    {
      endpoint: "GET /test.eventsource",
      fetch: serverEvents.fetch,
    },
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(import.meta.resolve("./client/")),
    },
  ],
});

let debug = false;
const browser = await chromium.launch({
  headless: !debug,
});
const browserContext = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await browserContext.newPage();

await page.goto(`${server.origin}/main.html`);
await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  const eventSource = new EventSource(`/test.eventsource`, {
    withCredentials: true,
  });
  return new Promise((resolve, reject) => {
    eventSource.onopen = () => {
      resolve();
    };
    eventSource.onerror = (errorEvent) => {
      reject(errorEvent);
    };
  });
});

{
  const actual = serverEvents.getClientCount();
  const expect = 1;
  assert({ actual, expect });
}

await page.evaluate(() => {
  // eslint-disable-next-line no-undef
  window.location.reload(true);
});
await new Promise((resolve) => setTimeout(resolve, 2000));

{
  const actual = serverEvents.getClientCount();
  const expect = 0;
  assert({ actual, expect });
}

if (!debug) {
  browser.close();
}
