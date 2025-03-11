import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  bundling: false,
  minification: false,
  watch: true,
});
