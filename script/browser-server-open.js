const {
  serverBrowserOpen,
  createJSCompileServiceForProject,
  createCancel,
} = require("../dist/index.js")
const path = require("path")

const localRoot = path.resolve(__dirname, "../")
const compileInto = "build"
const watch = true

const exec = async ({ cancellation }) => {
  const { compileService, watchPredicate, groupMap } = await createJSCompileServiceForProject({
    cancellation,
    localRoot,
    compileInto,
  })

  return serverBrowserOpen({
    cancellation,
    localRoot,
    compileInto,
    compileService,
    groupMap,

    watch,
    watchPredicate,
  })
}

const { cancellation, cancel } = createCancel()
exec({ cancellation })
process.on("SIGINT", () => {
  cancel("process interrupt").then(() => process.exit(0))
})
