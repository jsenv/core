import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";

try {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
  });
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expected = `Failed to fetch url content
--- reason ---
no entry on filesystem
--- url ---
${new URL("./client/not_found.js", import.meta.url).href}
--- url reference trace ---
${new URL("./client/intermediate.js", import.meta.url).href}:2:7
  1 | // eslint-disable-next-line import/no-unresolved
> 2 | import "./not_found.js";
            ^
  3 | 
--- plugin name ---
"jsenv:file_url_fetching"`;
  assert({ actual, expected });
}
