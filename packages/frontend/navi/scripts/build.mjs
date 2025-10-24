import { build } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.js": {
      buildRelativeUrl: "./jsenv_navi.js",
      runtimeCompat: {
        chrome: "90",
      },
      minification: false,
      preserveComments: true, // JSDoc comments are useful when people use the built file as reference
      versioning: false,
      ignore: {
        "file://**/node_modules/": true,
        "file://**/node_modules/@jsenv/": false,
      },
      plugins: [jsenvPluginPreact()],
    },
  },
});
