import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";

import { execute, chromium, firefox, webkit } from "@jsenv/test";

const test = async (params) => {
  const devServer = await startDevServer({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    keepProcessAlive: false,
    port: 0,
    services: [
      {
        injectResponseHeaders: () => {
          return {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
          };
        },
      },
    ],
  });
  const { memoryUsage } = await execute({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    webServer: {
      origin: devServer.origin,
      rootDirectoryUrl: new URL("./client/", import.meta.url),
    },
    fileRelativeUrl: `./main.html`,
    mirrorConsole: false,
    measureMemoryUsage: true,
    collectConsole: true,
    ...params,
  });
  devServer.stop();
  const actual = memoryUsage;
  const expected =
    params.runtime.name === "chromium"
      ? assert.between(4_000_000, 8_000_000) // around 5MB
      : null;
  assert({ actual, expected });
};

await test({
  runtime: chromium(),
});
if (process.platform !== "win32") {
  await test({ runtime: firefox() });
}
await test({ runtime: webkit() });
