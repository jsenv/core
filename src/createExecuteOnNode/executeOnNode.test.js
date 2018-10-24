import path from "path"
import { executeOnNode } from "./executeOnNode.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = true
const file = `src/__test__/file.js`

createPredicateFromStructure({ root }).then(({ instrumentPredicate, watchPredicate }) => {
  return executeOnNode({
    localRoot,
    compileInto,
    file,
    instrumentPredicate,
    watch,
    watchPredicate,
    verbose: true,
  })
})
