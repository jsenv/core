import { assert } from "@jsenv/assert";
import { chromium } from "playwright";

import { createSSERoom, fetchFileSystem, startServer } from "@jsenv/server";

if (process.platform !== "win32") {
  const room = createSSERoom({
    // logLevel: "debug",
    maxClientAllowed: 1,
  });
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    services: [
      {
        handleRequest: (request) => {
          const { accept = "" } = request.headers;
          if (accept.includes("text/event-stream")) {
            return room.join(request);
          }
          return fetchFileSystem(new URL("./main.html", import.meta.url));
        },
      },
    ],
  });

  const browser = await chromium.launch({
    args: [],
  });
  const browserContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await browserContext.newPage();

  await page.goto(server.origin);

  await page.evaluate((serverOrigin) => {
    // eslint-disable-next-line no-undef
    const eventSource = new EventSource(serverOrigin, {
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
  }, server.origin);

  {
    const actual = room.getRoomClientCount();
    const expect = 1;
    assert({ actual, expect });
  }

  await page.evaluate(() => {
    // eslint-disable-next-line no-undef
    window.location.reload(true);
  });
  await new Promise((resolve) => setTimeout(resolve, 2000));

  {
    const actual = room.getRoomClientCount();
    const expect = 0;
    assert({ actual, expect });
  }

  browser.close();
}
