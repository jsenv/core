import { build } from "@jsenv/core"
import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/filesystem"

const jsenvRootDirectoryUrl = new URL("../../", import.meta.url)
const jsenvDistDirectoryUrl = new URL("./dist/", jsenvRootDirectoryUrl)

// pour build jsenv lui-meme comment on va faire?
// - il faut que le build sache qu'on build pour node et préserve les imports builtin
// - il faut garder comme externe toutes les deps pour commencer
// (ensuite on fera une liste de ce qu'on peut bundle)
// - il faut que jsenv puisse s'éxecuter depuis dist

const ignoreMetaMap = normalizeStructuredMetaMap(
  {
    ignore: {
      "**/*": false,
      "**/node_modules/": true,
    },
  },
  jsenvRootDirectoryUrl.href,
)

await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: jsenvDistDirectoryUrl,
  entryPoints: {
    "./main.js": "main.js",
  },
  baseUrl: "./",
  sourcemaps: "file",
  minification: false,
  versioning: false,
  assetManifest: false,
  runtimeCompat: {
    node: "16.14",
  },
  writeGeneratedFiles: true,
  // bundling: {
  //   js_module: {
  //     include: {
  //       "**/*": true,
  //       "**/node_modules/": false,
  //     },
  //   },
  // },
  // for now ignore all node_modules
  // ideally later we'll selectively allow some node_modules
  // to be bundled and move them to "@jsenv/core" devDependencies
  plugins: [
    {
      name: "jsenv:ignore",
      appliesDuring: "*",
      redirectUrl: (reference) => {
        reference.shouldIgnore = urlToMeta({
          url: reference.url,
          structuredMetaMap: ignoreMetaMap,
        }).ignore
      },
    },
  ],
})

// "s.js" is used in the build files, it must be compatible as much as possible
// so we convert async/await, arrow function, ... to be compatible with
// old browsers
// await build({
//   rootDirectoryUrl: jsenvRootDirectoryUrl,
//   buildDirectoryUrl: jsenvDistDirectoryUrl,
//   entryPoints: {
//     "./src/plugins/transpilation/as_js_classic/client/s.js":
//       "s.js?as_js_classic",
//   },
//   buildDirectoryClean: false,
//   runtimeCompat: {
//     chrome: "0",
//     firefox: "0",
//   },
//   baseUrl: "./",
//   sourcemaps: "file",
//   minification: false,
//   versioning: false,
//   assetManifest: false,
// })
