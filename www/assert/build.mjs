import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: { "./index.html": "index.html" },
  runtimeCompat: { chrome: "90" },
  minification: false,
  http: true,
});
