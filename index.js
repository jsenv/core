// https://github.com/jsenv/core/blob/master/src/api/api.js
// https://github.com/ModuleLoader/system-register-loader/blob/master/src/system-register-loader.js

// pour le coverage
// https://github.com/jsenv/core/blob/master/more/test/playground/coverage/run.js
// https://github.com/jsenv/core/blob/master/more/to-externalize/module-cover/index.js

import { createFileStructure } from "@dmail/project-structure"

export { openCompileServer } from "./src/openCompileServer/openCompileServer.js"
export { openBrowserServer } from "./src/openBrowserServer/openBrowserServer.js"

export const createPredicateFromStructure = ({ root }) => {
  return createFileStructure({
    root,
  }).then(({ getMetaForLocation }) => {
    const instrumentPredicate = (file) => {
      return Boolean(getMetaForLocation(file).cover)
    }

    const watchPredicate = (file) => {
      return Boolean(getMetaForLocation(file).watch)
    }

    return { instrumentPredicate, watchPredicate }
  })
}
