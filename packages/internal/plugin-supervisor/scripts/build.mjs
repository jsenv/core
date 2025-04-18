import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./main.js": {
      buildRelativeUrl: "./jsenv_plugin_supervisor.js",
      ignore: {
        "/**/node_modules/@jsenv/ast/": true, // cannot inline "parse5", "@babel/core" and "postcss"
      },
      runtimeCompat: {
        node: "16.2.0",
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
