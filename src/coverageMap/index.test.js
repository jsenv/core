import path from "path"
import { createFileStructure } from "@dmail/project-structure"
import { openNodeClient } from "../openNodeClient/openNodeClient.js"
import { getCoverageAndOutputForClients } from "./index.js"

const root = path.resolve(__dirname, "../../../")
const into = "dist"

createFileStructure({ root }).then(({ forEachFileMatching, getMetaForLocation }) => {
  return getCoverageAndOutputForClients({
    root,
    into,
    instrumentPredicate: (file) => getMetaForLocation(file).instrument,
    getFilesToCover: () =>
      forEachFileMatching(({ cover }) => cover, ({ relativeName }) => relativeName),
    clients: [
      {
        getExecute: openNodeClient,
        getFiles: () => ["src/__test__/file.test.js"],
      },
      // {
      //   getExecute: openChromiumClient,
      //   getFiles: () => ["src/__test__/file.test.js"]
      // },
    ],
  })
})
