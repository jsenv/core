const { openBrowserServer, createFunctionsForProject } = require("../dist/index.js")

const path = require("path")

const root = path.resolve(__dirname, "../")

const watch = true

createFunctionsForProject({ root }).then(
  ({ watchPredicate, jsCompileService, LOCAL_ROOT, COMPILE_INTO, VARS }) => {
    return openBrowserServer({
      LOCAL_ROOT,
      COMPILE_INTO,
      VARS,
      watch,
      watchPredicate,
      compileService: jsCompileService,
    })
  },
)
