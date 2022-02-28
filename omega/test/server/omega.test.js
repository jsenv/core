import { startOmegaServer } from "#omega/server/server.js"

import { jsenvPluginFileSystem } from "#omega/plugins/filesystem/jsenv_plugin_filesystem.js"
import { jsenvPluginBabel } from "#omega/plugins/babel/jsenv_plugin_babel.js"
import { jsenvPluginUrlMentions } from "#omega/plugins/url_mentions/jsenv_plugin_url_mentions.js"
import { jsenvPluginEventSourceClient } from "#omega/plugins/event_source_client/jsenv_plugin_event_source_client.js"

const server = await startOmegaServer({
  projectDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [
    jsenvPluginEventSourceClient(),
    jsenvPluginFileSystem(),
    jsenvPluginBabel(),
    jsenvPluginUrlMentions(),
  ],
  keepProcessAlive: true,
  port: 3589,
  scenario: "dev",
})
console.log(server.origin)

// const { fetchUrl } = await import("@jsenv/core/src/internal/fetching.js")
// const response = await fetchUrl(`${server.origin}/main.js`)
// const text = await response.text()
// console.log(text)
