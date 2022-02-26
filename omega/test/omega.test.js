import { startOmegaServer } from "#omega/server/server.js"
import { jsenvPluginFileSystem } from "#omega/plugins/filesystem/jsenv_plugin_filesystem.js"
import { jsenvPluginBabel } from "#omega/plugins/babel/jsenv_plugin_babel.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetching.js"
import { jsenvPluginUrlMentions } from "#omega/plugins/url_mentions/jsenv_plugin_url_mentions.js"

const server = await startOmegaServer({
  projectDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [
    jsenvPluginFileSystem(),
    jsenvPluginUrlMentions({
      projectDirectoryUrl: new URL("./client/", import.meta.url),
    }),
    jsenvPluginBabel(),
  ],
  keepProcessAlive: true,
  port: 3589,
  scenario: "dev",
})

const response = await fetchUrl(`${server.origin}/main.js`)
const text = await response.text()
console.log(text)
