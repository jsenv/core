import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";

import { startServer, jsenvServiceErrorHandler } from "@jsenv/server";
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js";

// throw an error in "handleRequest"
{
  const { origin, stop } = await startServer({
    logLevel: "off",
    keepProcessAlive: false,
    services: [
      jsenvServiceErrorHandler(),
      {
        handleRequest: () => {
          const error = new Error("message");
          error.code = "TEST_CODE";
          throw error;
        },
      },
    ],
  });
  {
    const response = await fetchUrl(origin, {
      headers: {
        accept: "application/json",
      },
    });
    const actual = {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
      body: await response.text(),
    };
    const body = JSON.stringify({
      code: "TEST_CODE",
    });
    const expect = {
      url: `${origin}/`,
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        "cache-control": "no-store",
        "connection": "keep-alive",
        "content-length": String(Buffer.byteLength(body)),
        "content-type": "application/json",
        "date": actual.headers.date,
        "keep-alive": "timeout=5",
      },
      body,
    };
    assert({ actual, expect });
    stop();
  }
}

// throw a primitive in "handleRequest"
{
  const { origin, stop } = await startServer({
    logLevel: "off",
    keepProcessAlive: false,
    services: [
      jsenvServiceErrorHandler(),
      {
        handleRequest: () => {
          // eslint-disable-next-line no-throw-literal
          throw "here";
        },
      },
    ],
  });
  {
    const response = await fetchUrl(origin, {
      headers: {
        accept: "application/json",
      },
    });
    const actual = {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
      body: await response.text(),
    };
    const body = JSON.stringify({
      code: "VALUE_THROWED",
      value: "here",
    });
    const expect = {
      url: `${origin}/`,
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        "cache-control": "no-store",
        "connection": "keep-alive",
        "content-length": String(Buffer.byteLength(body)),
        "content-type": "application/json",
        "date": actual.headers.date,
        "keep-alive": "timeout=5",
      },
      body,
    };
    assert({ actual, expect });
    stop();
  }
}
