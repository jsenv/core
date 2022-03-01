import { startOmegaServer } from "#omega/server/server.js"

import { jsenvPluginInlineRessources } from "#omega/plugins/inline_ressources/jsenv_plugin_inline_ressources.js"
import { jsenvPluginEventSourceClient } from "#omega/plugins/event_source_client/jsenv_plugin_event_source_client.js"
import { jsenvPluginHtmlSupervisor } from "#omega/plugins/html_supervisor/jsenv_plugin_html_supervisor.js"
import { jsenvPluginFileSystem } from "#omega/plugins/filesystem/jsenv_plugin_filesystem.js"
import { jsenvPluginBabel } from "#omega/plugins/babel/jsenv_plugin_babel.js"
import { jsenvPluginUrlMentions } from "#omega/plugins/url_mentions/jsenv_plugin_url_mentions.js"

const server = await startOmegaServer({
  projectDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [
    jsenvPluginInlineRessources(),
    jsenvPluginEventSourceClient(),
    jsenvPluginHtmlSupervisor(),
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
