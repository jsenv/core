import { assert } from "@jsenv/assert";
import { jsenvPluginMinification } from "@jsenv/plugin-minification";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const { buildInlineContents } = await build({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  versioning: false,
  runtimeCompat: { chrome: "89" },
  plugins: [jsenvPluginMinification()],
});
const server = await startFileServer({
  rootDirectoryUrl: new URL("./dist/", import.meta.url),
});
const { returnValue } = await executeInBrowser({
  url: `${server.origin}/main.html`,
  /* eslint-disable no-undef */
  pageFunction: async (jsRelativeUrl) => {
    const namespace = await import(jsRelativeUrl);
    return { ...namespace };
  },
  /* eslint-enable no-undef */
  pageArguments: ["./js/main.js"],
});
const actual = {
  returnValue,
  buildInlineContents,
};
const expected = {
  returnValue: {
    data: { answer: 42 },
  },
  buildInlineContents: {
    // this is to assert JSON string does not contain whitespaces
    "js/main.js@L1C31-L3C2.json": '{"answer":42}',
  },
};
assert({ actual, expected });
