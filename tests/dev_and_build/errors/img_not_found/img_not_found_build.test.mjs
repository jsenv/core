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
${new URL("./client/img.png", import.meta.url).href}
--- url reference trace ---
${new URL("./client/main.html", import.meta.url).href}:9:10
  8  |   <body>
> 9  |     <img src="./img.png" />
                ^
  10 |   </body>
--- plugin name ---
"jsenv:file_url_fetching"`;
  assert({ actual, expected });
}
