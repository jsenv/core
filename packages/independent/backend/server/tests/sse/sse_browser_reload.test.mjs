import { assert } from "@jsenv/assert";
import {
  createFileSystemRequestHandler,
  createSSERoom,
  startServer,
} from "@jsenv/server";
import { chromium } from "playwright";

if (process.platform !== "win32") {
  const room = createSSERoom({
    // logLevel: "debug",
    maxClientAllowed: 1,
  });
  const server = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes: [
      {
        endpoint: "GET *",
        acceptedContentTypes: ["text/event-stream"],
        response: (request) => room.join(request),
      },
      {
        endpoint: "GET *",
        response: createFileSystemRequestHandler(import.meta.resolve("./")),
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
