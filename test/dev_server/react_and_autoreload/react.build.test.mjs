import { build } from "@jsenv/core"
import { jsenvPluginReact } from "@jsenv/core/packages/jsenv-plugin-react/main.js"

await build({
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: {
    "./main.html": "index.html",
  },
  plugins: [jsenvPluginReact()],
  minification: false,
})
