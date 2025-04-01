import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  bundling: false,
  minification: false,
  watch: true,
});
