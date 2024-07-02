import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";

try {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
  });
  throw new Error("should throw");
} catch (e) {
  const actual = e.message;
  const expect = `Failed to fetch url content
--- reason ---
no entry on filesystem
--- url ---
${new URL("./client/img.png", import.meta.url).href}
--- url reference trace ---
${new URL("./client/main.html", import.meta.url).href}:9:10
6 |   </head>
7 | 
8 |   <body>
9 |     <img src="./img.png" />
             ^
--- plugin name ---
"jsenv:file_url_fetching"`;
  assert({ actual, expect });
}
