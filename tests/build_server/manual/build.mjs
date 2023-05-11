import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  watch: true,
});
