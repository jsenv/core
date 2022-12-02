import { build } from "@jsenv/core"

build({
  rootDirectoryUrl: new URL("../", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  entryPoints: {
    "./src/jsenv_plugin_toolbar.js": "jsenv_plugin_toolbar.js",
  },
  urlAnalysis: {
    include: {
      "/**/*": true,
      "/**/node_modules/@jsenv/ast/": false, // cannot inline "parse5", "@babel/core" and "postcss"
    },
  },
  minification: false,
})
