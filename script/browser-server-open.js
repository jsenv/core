const {
  serverBrowserOpen,
  createJsCompileService,
  createCancellationSource,
} = require("../dist/index.js")
const path = require("path")

const localRoot = path.resolve(__dirname, "../")
const compileInto = "build"
const hotreload = true

const exec = async ({ cancellationToken }) => {
  const compileService = await createJsCompileService({
    cancellationToken,
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
