import path from "path"
import { openCompileServer } from "../openCompileServer/index.js"
import { createPredicateFromStructure } from "../../index.js"
import { executeOnNode } from "./executeOnNode.js"

const root = path.resolve(__dirname, "../../../")
const into = "build"
const watch = true
const instrument = false
const file = `src/__test__/file.js`

createPredicateFromStructure({ root }).then(({ instrumentPredicate, watchPredicate }) => {
  return executeOnNode({
    openCompileServer,
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
