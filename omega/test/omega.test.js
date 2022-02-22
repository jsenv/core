import { startOmegaServer } from "#omega/server/server.js"
import { webResolveJsenvPlugin } from "#omega/plugins/web_resolve_jsenv_plugin/web_resolve_jsenv_plugin.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetching.js"

const server = await startOmegaServer({
  projectDirectoryUrl: new URL("./", import.meta.url),
  plugins: [webResolveJsenvPlugin()],
})

const response = await fetchUrl(`${server.origin}/file.js`)
const text = await response.text()
console.log(text)
