const {
  serverBrowserOpen,
  createJSCompileServiceForProject,
  createCancel,
} = require("../dist/index.js")
const path = require("path")

const { cancellation, cancel } = createCancel()
const localRoot = path.resolve(__dirname, "../")
const compileInto = "build"
const watch = true

createJSCompileServiceForProject({ cancellation, localRoot, compileInto }).then(
  ({ compileService, watchPredicate, groupMap }) => {
    return serverBrowserOpen({
      cancellation,
      localRoot,
      compileInto,
      compileService,
      groupMap,

      watch,
      watchPredicate,
    })
  },
)

process.on("SIGINT", () => {
  cancel().then(() => process.exit(0))
})
