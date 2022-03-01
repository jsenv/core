import { startOmegaServer } from "#omega/server/server.js"

import { jsenvPluginInlineRessources } from "#omega/plugins/inline_ressources/jsenv_plugin_inline_ressources.js"
import { jsenvPluginAutoreload } from "#omega/plugins/autoreload/jsenv_plugin_autoreload.js"
import { jsenvPluginHtmlSupervisor } from "#omega/plugins/html_supervisor/jsenv_plugin_html_supervisor.js"
import { jsenvPluginDataUrls } from "#omega/plugins/data_urls/jsenv_plugin_data_urls.js"
import { jsenvPluginFileSystem } from "#omega/plugins/filesystem/jsenv_plugin_filesystem.js"
import { jsenvPluginBabel } from "#omega/plugins/babel/jsenv_plugin_babel.js"
import { jsenvPluginUrlMentions } from "#omega/plugins/url_mentions/jsenv_plugin_url_mentions.js"

const server = await startOmegaServer({
  projectDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [
    jsenvPluginInlineRessources(),
    jsenvPluginAutoreload(),
    jsenvPluginHtmlSupervisor(),
    jsenvPluginDataUrls(),
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
