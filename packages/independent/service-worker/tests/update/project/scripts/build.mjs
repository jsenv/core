import { build } from "@jsenv/core";

await build({
  rootDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  minification: false,
});
