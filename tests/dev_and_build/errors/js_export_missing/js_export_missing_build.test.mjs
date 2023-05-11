import { assert } from "@jsenv/assert";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";

try {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    plugins: [jsenvPluginBundling()],
  });
  throw new Error("should throw");
} catch (e) {
  const expected = `"answer" is not exported by "tests/dev_and_build/errors/js_export_missing/client/file.js", imported by "tests/dev_and_build/errors/js_export_missing/client/main.js".
--- frame ---
1: // eslint-disable-next-line import/named
2: import { answer } from`;
  const actual = e.message.slice(0, expected.length);
  assert({ actual, expected });
}
