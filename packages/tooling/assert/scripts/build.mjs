import { build } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./assert_browser.js": {
      buildRelativeUrl: "./browser/jsenv_assert_browser.js",
      runtimeCompat: {
        chrome: "64",
        edge: "79",
        firefox: "67",
        safari: "11.3",
      },
      minification: false,
      versioning: false,
    },
    "./assert_node.js": {
      buildRelativeUrl: "./node/jsenv_assert_node.js",
      runtimeCompat: { node: "20" },
      plugins: [
        jsenvPluginCommonJs({
          include: {
            "file:///**/node_modules/graphemer/": true,
          },
        }),
      ],
    },
  },
});
