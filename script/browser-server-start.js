const {
  openCompileServer,
  openBrowserServer,
  createPredicateFromStructure,
} = require("../dist/index.js")
const path = require("path")

const root = path.resolve(__dirname, "../")
const into = "build"
const watch = true

createPredicateFromStructure({ root }).then(({ instrumentPredicate, watchPredicate }) => {
  return openBrowserServer({
    openCompileServer,
    root,
    into,
    watch,
    watchPredicate,
    instrumentPredicate,
  })
})
