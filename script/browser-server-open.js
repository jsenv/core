const { serverBrowserOpen, createJSCompileServiceForProject } = require("../dist/index.js")
const path = require("path")

const localRoot = path.resolve(__dirname, "../")
const compileInto = "build"
const watch = true

createJSCompileServiceForProject({ localRoot, compileInto }).then(
  ({ compileService, watchPredicate, groupMap, groupMapDefaultId }) => {
    return serverBrowserOpen({
      localRoot,
      compileInto,
      watch,
      watchPredicate,
      compileService,
      groupMap,
      groupMapDefaultId,
    })
  },
)
