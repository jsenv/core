import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

const plugins = [
  jsenvPluginPreact(),
  jsenvPluginCommonJs({
    include: {
      "/**/node_modules/react-is/": true,
      "/**/node_modules/use-sync-external-store/": {
        external: ["react"],
      },
      "/**/node_modules/hoist-non-react-statics/": {
        // "react-redux" depends on
        // - react-is@18+
        // - hoist-non-react-statics@3.3.2+
        // but "hoist-non-react-statics@3.3.2" depends on
        // - react-is@16+
        // In the end there is 2 versions of react-is trying to cohabit
        // to prevent them to clash we let rollup inline "react-is" into "react-statics"
        // thanks to the comment below
        // external: ["react-is"],
      },
    },
  }),
];

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  plugins,
  port: 0,
});
const { returnValue } = await executeInBrowser({
  url: `${devServer.origin}/main.html`,
  /* eslint-disable no-undef */
  pageFunction: () => window.resultPromise,
  /* eslint-enable no-undef */
});
const actual = returnValue;
const expect = {
  spanContentAfterIncrement: "1",
  spanContentAfterDecrement: "0",
};
assert({ actual, expect });
