import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import { execute, chromium, firefox, webkit } from "@jsenv/test";

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
  });
  const { errors } = await execute({
    // logLevel: "debug"
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: new URL("./client/", import.meta.url),
    },
    fileRelativeUrl: `./main.html`,
    mirrorConsole: false,
    collectConsole: true,
    ignoreError: true,
    ...params,
  });
  devServer.stop();
  const [error] = errors;
  if (params.runtime.name === "chromium") {
    const actual = error.stack;
    const expected = "SyntaxError: Unexpected end of input";
    assert({ actual, expected });
  }
  if (params.runtime.name === "firefox") {
    const actual = error.stack;
    const expected = "SyntaxError: expected expression, got end of script";
    assert({ actual, expected });
  }
  if (params.runtime.name === "webkit") {
    const actual = error.stack;
    const expected = `SyntaxError: Unexpected end of script`;
    assert({ actual, expected });
  }
};

await test({ runtime: chromium() });
if (process.platform !== "win32") {
  await test({ runtime: firefox() });
}
await test({ runtime: webkit() });
