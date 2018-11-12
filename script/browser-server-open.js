const { serverBrowserOpen, createJsCompileService, createCancel } = require("../dist/index.js")
const path = require("path")

const localRoot = path.resolve(__dirname, "../")
const compileInto = "build"
const hotreload = true

const exec = async ({ cancellation }) => {
  const compileService = await createJsCompileService({
    cancellation,
    localRoot,
    compileInto,
    watch: hotreload,
  })

  return serverBrowserOpen({
    cancellation,
    localRoot,
    compileInto,
    compileService,

    hotreload,
  })
}

const { cancellation, cancel } = createCancel()
exec({ cancellation })
process.on("SIGINT", () => {
  cancel("process interrupt").then(() => process.exit(0))
})
