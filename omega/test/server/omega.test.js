import { requestCertificateForLocalhost } from "@jsenv/https-local"

import { startOmegaServer } from "#omega/server/server.js"
import { jsenvPluginPreact } from "@jsenv/core/packages/jsenv-plugin-preact/index.js"
import { jsenvPluginInlineRessources } from "#omega/plugins/inline_ressources/jsenv_plugin_inline_ressources.js"
import { jsenvPluginAutoreload } from "#omega/plugins/autoreload/jsenv_plugin_autoreload.js"
import { jsenvPluginHtmlSupervisor } from "#omega/plugins/html_supervisor/jsenv_plugin_html_supervisor.js"
import { jsenvPluginDataUrls } from "#omega/plugins/data_urls/jsenv_plugin_data_urls.js"
import { jsenvPluginFileSystem } from "#omega/plugins/filesystem/jsenv_plugin_filesystem.js"
import { jsenvPluginCommonJsGlobals } from "#omega/plugins/commonjs_globals/jsenv_plugin_commonjs_globals.js"
import { jsenvPluginBabel } from "#omega/plugins/babel/jsenv_plugin_babel.js"
import { jsenvPluginUrlMentions } from "#omega/plugins/url_mentions/jsenv_plugin_url_mentions.js"

const { serverCertificate, serverCertificatePrivateKey } =
  await requestCertificateForLocalhost({
    serverCertificateAltNames: ["local"],
  })
const server = await startOmegaServer({
  keepProcessAlive: true,
  port: 3589,
  protocol: "https",
  certificate: serverCertificate,
  privateKey: serverCertificatePrivateKey,
  projectDirectoryUrl: new URL("./client/", import.meta.url),
  plugins: [
    jsenvPluginPreact(),
    jsenvPluginInlineRessources(),
    jsenvPluginAutoreload(),
    jsenvPluginHtmlSupervisor(),
    jsenvPluginDataUrls(),
    jsenvPluginFileSystem(),
    jsenvPluginCommonJsGlobals(),
    jsenvPluginBabel(),
    jsenvPluginUrlMentions(),
  ],
  scenario: "dev",
})
console.log(server.origin)

// const { fetchUrl } = await import("@jsenv/core/src/internal/fetching.js")
// const response = await fetchUrl(`${server.origin}/main.js`)
// const text = await response.text()
// console.log(text)
