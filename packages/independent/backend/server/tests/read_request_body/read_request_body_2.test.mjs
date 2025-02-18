import { assert } from "@jsenv/assert";
import { startServer } from "@jsenv/server";
import { readRequestBody } from "@jsenv/server/src/request_body_handling.js";
import { fetchUsingNodeBuiltin } from "@jsenv/server/tests/test_helpers.mjs";

const { origin } = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  services: [
    {
      handleRequest: async (request) => {
        const requestBody = await readRequestBody(request, { as: "string" });
        const responseBody = `${requestBody} world`;
        return {
          status: 200,
          headers: {
            "content-length": Buffer.byteLength(responseBody),
          },
          body: responseBody,
        };
      },
    },
  ],
});
const response = await fetchUsingNodeBuiltin(origin, { body: "Hello" });

const actual = await response.text();
const expect = "Hello world";
assert({ actual, expect });
