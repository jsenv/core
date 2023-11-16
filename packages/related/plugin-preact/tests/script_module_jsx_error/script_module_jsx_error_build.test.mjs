import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";

const consoleErrorCalls = [];
const { error } = console;
console.error = (message) => {
  consoleErrorCalls.push(message);
};

const test = async (params) => {
  await build({
    logLevel: "error",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.noeslint.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
};

try {
  await test({
    runtimeCompat: { chrome: "89" },
    bundling: false,
    minification: false,
  });
  const htmlFileUrl = new URL("./client/main.noeslint.html", import.meta.url)
    .href;
  const expected = `Error while cooking js_module declared in ${htmlFileUrl}:14:5`;
  const actual = consoleErrorCalls[0].slice(0, expected.length);
  assert({ actual, expected });
} finally {
  console.error = error;
}
