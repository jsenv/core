import path from "path"
import { createPredicateFromStructure } from "../openCompileServer/index.js"
import { executeOnNode } from "./executeOnNode.js"

const root = path.resolve(__dirname, "../../../")
const into = "build"
const watch = true
const instrument = false
const file = `src/__test__/file.js`

createPredicateFromStructure({ root }).then(({ instrumentPredicate, watchPredicate }) => {
  return executeOnNode({
    root,
    into,
    file,
    instrument,
    instrumentPredicate,
    watch,
    watchPredicate,
    verbose: true,
  })
})
