import { build } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.js": {
      buildRelativeUrl: "./jsenv_navi.js",
      mode: "package",
      runtimeCompat: {
        chrome: "90",
      },
      ignore: {
        "file://**/node_modules/": true,
        "file://**/node_modules/@jsenv/": false,
      },
      plugins: [jsenvPluginPreact()],
      bundling: {
        js_module: {
          chunks: {
            jsenv_navi_side_effects: {
              "./src/navi_css_vars.js": true,
            },
          },
        },
      },
    },
  },
});
