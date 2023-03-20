import { build } from "@jsenv/core"
import { jsenvPluginBundling } from "@jsenv/plugin-bundling"

await build({
  logLevel: "warn",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "main.html",
  },
  plugins: [jsenvPluginBundling()],
  writeGeneratedFiles: true,
})
