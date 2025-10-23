import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.js": {
      buildRelativeUrl: "./jsenv_dom.js",
      runtimeCompat: {
        chrome: "64",
        edge: "79",
        firefox: "67",
        safari: "11.3",
      },
      minification: false,
      versioning: false,
    },
  },
});
