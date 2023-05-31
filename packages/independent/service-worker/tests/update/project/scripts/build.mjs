import { build } from "@jsenv/core";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

await build({
  rootDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  plugins: [jsenvPluginBundling()],
});
