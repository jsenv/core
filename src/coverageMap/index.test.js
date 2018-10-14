import path from "path"
import { createFileStructure } from "@dmail/project-structure"
import { openNodeClient } from "../openNodeClient/openNodeClient.js"
import { getCoverageAndOutputForClients } from "./index.js"

const root = path.resolve(__dirname, "../../../")
const into = "dist"
const instrumentMetaPredicate = ({ instrument }) => instrument
const coverMetaPredicate = ({ cover }) => cover

createFileStructure({ root }).then(({ forEachFileMatching, getMetaForLocation }) => {
  return getCoverageAndOutputForClients({
    root,
    into,
    instrumentPredicate: (file) => instrumentMetaPredicate(getMetaForLocation(file)),
    getFilesToCover: () =>
      forEachFileMatching(coverMetaPredicate, ({ relativeName }) => relativeName),
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
