import { startOmegaServer } from "#omega/server/server.js"
import { webResolveJsenvPlugin } from "#omega/plugins/web_resolve_jsenv_plugin/web_resolve_jsenv_plugin.js"
import { loadFileSystemJsenvPlugin } from "#omega/plugins/load_filesystem_jsenv_plugin/load_filesystem_jsenv_plugin.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetching.js"

const server = await startOmegaServer({
  projectDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [webResolveJsenvPlugin(), loadFileSystemJsenvPlugin()],
  keepProcessAlive: true,
  port: 3589,
})

const response = await fetchUrl(`${server.origin}/main.js`)
const text = await response.text()
console.log(text)
