import { assert } from "@jsenv/assert";
import { execute, nodeChildProcess, nodeWorkerThread } from "@jsenv/test";

const test = async (params) => {
  const { errors } = await execute({
    // logLevel: "debug"
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    fileRelativeUrl: `./main.mjs`,
    // keepRunning: true,
    mirrorConsole: false,
    collectConsole: true,
    ignoreError: true,
    ...params,
  });
  const [error] = errors;
  const clientDirectoryUrl = new URL("./client", import.meta.url).href;
  const actual = {
    isException: error.isException,
    name: error.name,
    message: error.message,
    stack: error.stack,
    site: error.site,
  };
  const expected = {
    isException: true,
    name: "AssertionError",
    message: `unexpected string, "f" was found instead of "b" at index 0
--- details ---
"foo"
 ^ unexpected character, expected string continues with "bar"
--- path ---
actual[0]`,
    stack:
      assert.startsWith(`AssertionError: unexpected string, "f" was found instead of "b" at index 0
--- details ---
"foo"
 ^ unexpected character, expected string continues with "bar"
--- path ---
actual[0]
  at ${clientDirectoryUrl}/main.mjs:3:1`),
    site: {
      url: `${clientDirectoryUrl}/main.mjs`,
      line: 3,
      column: 0,
    },
  };
  assert({ actual, expected });
};

await test({
  runtime: nodeChildProcess(),
});
await test({
  runtime: nodeWorkerThread(),
});
