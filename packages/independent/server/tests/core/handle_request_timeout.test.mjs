import { assert } from "@jsenv/assert";
import { fetchUrl } from "@jsenv/fetch";

import { startServer } from "@jsenv/server";

let behaviour = "timeout";
const server = await startServer({
  logLevel: "off",
  keepProcessAlive: false,
  responseTimeout: 500,
  requestBodyLifetime: 200,
  services: [
    {
      handleRequest: async () => {
        if (behaviour === "timeout") {
          await new Promise(() => {});
        }
        return { status: 200 };
      },
    },
  ],
});

// first request timesout
{
  const response = await fetchUrl(server.origin);
  const { status, statusText } = response;
  const actual = { status, statusText };
  const expect = {
    status: 504,
    statusText: "server timeout after 0.5s waiting to handle request",
  };
  assert({ actual, expect });
}

// an other request if things are fixed should 200
{
  behaviour = "200";
  const response = await fetchUrl(server.origin);
  const { status } = response;
  const actual = { status };
  const expect = { status: 200 };
  assert({ actual, expect });
}
