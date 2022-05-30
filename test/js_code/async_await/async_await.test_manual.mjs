import { build } from "@jsenv/core"

const test = async (params) => {
  await build({
    logLevel: "warn",
    rootDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    minification: false,
    ...params,
  })
}

// async not supported (see babel_plugins_compatibility.js)
await test({
  runtimeCompat: {
    chrome: "54",
  },
})
