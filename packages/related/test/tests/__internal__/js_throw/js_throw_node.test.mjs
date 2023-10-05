import { assert } from "@jsenv/assert";
import { execute, nodeChildProcess } from "@jsenv/test";

// TODO: test also worker_thread

const test = async (params) => {
  const { errors } = await execute({
    // logLevel: "debug"
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    fileRelativeUrl: `./main.js`,
    // keepRunning: true,
    mirrorConsole: false,
    collectConsole: true,
    ignoreError: true,
    ...params,
  });
  return errors;
};

const [error] = await test({
  runtime: nodeChildProcess(),
});
const clientDirectoryUrl = new URL("./client", import.meta.url).href;

const actual = {
  isException: error.isException,
  message: error.message,
  site: error.site,
};
const expected = {
  isException: true,
  message: "Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE",
  site: {
    source: `${clientDirectoryUrl}/trigger_error.js`,
    line: 2,
    column: 8,
  },
};
assert({ actual, expected });

{
  const expected = `  at triggerError (${clientDirectoryUrl}/trigger_error.js:2:9)
  at ${clientDirectoryUrl}/main.js:3:1`;
  const actual = error.stackNormalized.slice(0, expected.length);
  assert({ actual, expected });
}
