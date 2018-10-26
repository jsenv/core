import path from "path"
import { createFileStructure } from "@dmail/project-structure"
import { createExecuteOnNode } from "../createExecuteOnNode/createExecuteOnNode.js"
import { getCoverageAndOutputForClients } from "./index.js"

const root = path.resolve(__dirname, "../../../")
const into = "dist"
const instrumentMetaPredicate = ({ instrument }) => instrument
// const coverMetaPredicate = ({ cover }) => cover

createFileStructure({ root })
  .then(({ getMetaForLocation }) => {
    return getCoverageAndOutputForClients({
      root,
      into,
      instrumentPredicate: (file) => instrumentMetaPredicate(getMetaForLocation(file)),
      getFilesToCover: () => ["src/__test__/file.js", "src/__test__/file2.js"],
      // forEachFileMatching(coverMetaPredicate, ({ relativeName }) => relativeName),
      clients: [
        {
          getExecute: (...args) => createExecuteOnNode(...args),
          getFiles: () => ["src/__test__/file.test.js"],
        },
        // {
        //   getExecute: openChromiumClient,
        //   getFiles: () => ["src/__test__/file.test.js"]
        // },
      ],
    })
  })
  .then(({ coverageMap, outputs }) => {
    debugger
  })
