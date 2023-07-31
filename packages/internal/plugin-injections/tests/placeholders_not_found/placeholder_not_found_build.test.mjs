import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";

const test = async (params) => {
  const consoleWarnings = [];
  const { warn } = console;
  console.warn = (warning) => {
    consoleWarnings.push(warning);
  };
  try {
    await build({
      logLevel: "warn",
      sourceDirectoryUrl: new URL("./client/", import.meta.url),
      buildDirectoryUrl: new URL("./dist/", import.meta.url),
      entryPoints: {
        "./main.html": "main.html",
      },
      injections: {
        "./main.html": () => {
          return {
            __DEMO__: "foo",
          };
        },
      },
      ...params,
    });
  } finally {
    console.warn = warn;
  }
  const actual = consoleWarnings;
  const fileUrl = new URL("./client/main.html", import.meta.url).href;
  const expected = [
    `placeholder "__DEMO__" not found in ${fileUrl}.
--- suggestion a ---
Add "__DEMO__" in that file.
--- suggestion b ---
Fix eventual typo in "__DEMO__"?
--- suggestion c ---
Mark injection as optional using PLACEHOLDER.optional()

import { PLACEHOLDER } from "@jsenv/core"

return {
  "__DEMO__": PLACEHOLDER.optional("foo")
}`,
  ];
  assert({ actual, expected });
};

await test({
  bundling: false,
  minification: false,
});
