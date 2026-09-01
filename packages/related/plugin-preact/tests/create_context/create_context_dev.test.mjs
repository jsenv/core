/*
 * "@prefresh/babel-plugin" rewrites "createContext()" into a memoized version of
 * itself; when babel re-enters that generated call the rewrite recurses until the
 * stack blows up (only reproducible when refreshInstrumentation is enabled).
 */

import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

const devServer = await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  keepProcessAlive: false,
  port: 0,
  plugins: [
    jsenvPluginPreact({
      refreshInstrumentation: true,
    }),
  ],
  clientAutoreload: false,
  ribbon: false,
  supervisor: false,
  directoryListing: false,
});
const response = await fetch(`${devServer.origin}/context.jsx`);
const responseText = await response.text();
assert({
  actual: {
    status: response.status,
    // each createContext() is wrapped once: "createContext[`id`] || (createContext[`id`] = createContext(...))"
    memoizationCount: (responseText.match(/createContext\[`/g) || []).length,
  },
  expect: {
    status: 200,
    memoizationCount: 4,
  },
});
