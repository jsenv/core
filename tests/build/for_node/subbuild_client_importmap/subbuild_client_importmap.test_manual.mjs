import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("./source/"),
  buildDirectoryUrl: import.meta.resolve("./build/"),
  entryPoints: { "./main.js": "main.js" },
  minification: false,
  runtimeCompat: {
    node: "20",
  },
  subbuilds: [
    {
      buildDirectoryUrl: import.meta.resolve("./build/client/"),
      entryPoints: {
        "./client/main.html": "main.html",
      },
      runtimeCompat: {
        chrome: "89",
      },
      http: true,
    },
  ],
});
