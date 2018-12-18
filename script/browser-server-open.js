const { pluginOptionMapToPluginMap } = require("@dmail/project-structure-compile-babel")
const { createCancellationSource } = require("@dmail/cancellation")
const { open: serverBrowserOpen } = require("../dist/src/server-browser/index.js")
const { createJsCompileService } = require("../dist/src/createJsCompileService.js")
const { localRoot } = require("../dist/src/localRoot.js")

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})
const compileInto = "build"
const hotreload = false

const exec = async ({ cancellationToken }) => {
  const compileService = await createJsCompileService({
    cancellationToken,
    pluginMap,
    localRoot,
    compileInto,
    watch: hotreload,
  })

  return serverBrowserOpen({
    cancellationToken,
    localRoot,
    compileInto,
    compileService,

    hotreload,
  })
}

const { cancel, token } = createCancellationSource()
exec({ cancellationToken: token })
process.on("SIGINT", () => {
  cancel("process interrupt").then(() => process.exit(0))
})
