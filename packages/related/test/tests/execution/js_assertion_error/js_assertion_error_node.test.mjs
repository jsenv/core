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
    message: `unexpected character in string
--- details ---
foo
^ unexpected "f", expected to continue with "bar"
--- path ---
actual[0]`,
    stack: assert.startsWith(`AssertionError: unexpected character in string
--- details ---
foo
^ unexpected "f", expected to continue with "bar"
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
