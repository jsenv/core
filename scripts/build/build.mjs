import { jsenvPluginBundling } from "@jsenv/plugin-bundling"
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs"
import { build } from "@jsenv/core"

const jsenvRootDirectoryUrl = new URL("../../", import.meta.url)
const jsenvDistDirectoryUrl = new URL("./dist/", jsenvRootDirectoryUrl)

await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: jsenvDistDirectoryUrl,
  entryPoints: {
    "./src/main.js": "main.js",
  },
  versioning: false,
  assetManifest: false,
  runtimeCompat: {
    node: "16.14",
  },
  directoryReferenceAllowed: true,
  urlAnalysis: {
    include: {
      "**/*": true,
      "**/node_modules/": false,
      // selectively allow some node_modules
      "**/node_modules/@jsenv/abort/": true,
      "**/node_modules/@jsenv/ast/": false, // cannot inline "parse5", "@babel/core" and "postcss"
      "**/node_modules/@jsenv/babel-plugins/": true,
      "**/node_modules/@jsenv/filesystem/": true,
      "**/node_modules/@jsenv/importmap/": true,
      "**/node_modules/@jsenv/integrity/": true,
      "**/node_modules/@jsenv/log/": true,
      "**/node_modules/@jsenv/node-esm-resolution/": true,
      "**/node_modules/@jsenv/server/": true,
      "**/node_modules/@jsenv/sourcemap/": false, // cannot inline "source-map"
      "**/node_modules/@jsenv/uneval/": true,
      "**/node_modules/@jsenv/url-meta/": true,
      "**/node_modules/@jsenv/urls/": true,
      "**/node_modules/@jsenv/utils/": true,
      "**/node_modules/ansi-escapes/": true,
      "**/node_modules/is-unicode-supported/": true,
      "**/node_modules/supports-color/": true,
      "**/node_modules/ws/": true,
    },
  },
  plugins: [
    jsenvPluginCommonJs({
      include: {
        "/**/node_modules/ws/": true,
      },
    }),
    jsenvPluginBundling({
      js_module: {
        babelHelpersChunk: false,
      },
    }),
  ],
  // writeGeneratedFiles: true,
})

// "s.js" is used in the build files, it must be compatible as much as possible
// so we convert async/await, arrow function, ... to be compatible with
// old browsers
await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: new URL("js", jsenvDistDirectoryUrl),
  entryPoints: {
    "./src/plugins/transpilation/as_js_classic/client/s.js?as_js_classic_library":
      "s.js",
  },
  directoryToClean: false,
  runtimeCompat: {
    chrome: "0",
    firefox: "0",
  },
  sourcemaps: "file",
  sourcemapsSourcesContent: true,
  versioning: false,
  assetManifest: false,
})
