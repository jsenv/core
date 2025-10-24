import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.js": {
      buildRelativeUrl: "./jsenv_dom.js",
      runtimeCompat: {
        chrome: "90",
      },
      minification: false,
      preserveComments: true, // JSDoc comments are useful when people use the built file as reference
      versioning: false,
      ignore: {
        "file://**/node_modules/": true,
      },
    },
  },
});
