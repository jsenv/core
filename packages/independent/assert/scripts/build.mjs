import { build } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

await build({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./assert_browser.js": "jsenv_assert_browser.js",
  },
  plugins: [
    jsenvPluginCommonJs({
      include: {
        "file:///**/node_modules/graphemer/": true,
      },
    }),
  ],
  runtimeCompat: {
    chrome: "64",
    edge: "79",
    firefox: "67",
    safari: "11.3",
  },
  minification: false,
  versioning: false,
});
