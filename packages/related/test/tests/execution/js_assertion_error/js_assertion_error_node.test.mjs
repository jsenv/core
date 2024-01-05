import stripAnsi from "strip-ansi";
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
    isError: error.isError,
    name: error.name,
    message: stripAnsi(error.message),
    stack: stripAnsi(error.stack),
    site: error.site,
  };
  const expected = {
    isException: true,
    isError: true,
    name: "AssertionError",
    message: `unexpected character in string
--- details ---
foo
^
unexpected "f", expected to continue with "bar"
--- path ---
actual`,
    stack: assert.startsWith(`AssertionError: unexpected character in string
--- details ---
foo
^
unexpected "f", expected to continue with "bar"
--- path ---
actual
  at ${clientDirectoryUrl}/main.mjs:3:1`),
    site: {
      url: `${clientDirectoryUrl}/main.mjs`,
      line: 3,
      column: 1,
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
