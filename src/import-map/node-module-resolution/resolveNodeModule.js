import { pathnameToDirname } from "@jsenv/module-resolution"
import { asyncFunctionCandidatesToElectedValuePromise } from "@dmail/helper"
import { readPackageData } from "./readPackageData.js"

export const resolveNodeModule = async ({ rootFolder, importerFilename, nodeModuleName }) => {
  const importerFolder = pathnameToDirname(importerFilename)
  const relativeFolder = importerFolder.slice(rootFolder.length)
  const relativeFolderNameArray = relativeFolder
    .split("/")
    .filter((value) => value !== "node_modules")
  const nodeModuleCandidateArray = relativeFolderNameArray
    .map((_, index) => `${relativeFolderNameArray.slice(1, index + 1).join("/")}`)
    // reverse to handle deepest (most scoped) folder fist
    .reverse()

  return asyncFunctionCandidatesToElectedValuePromise(
    nodeModuleCandidateArray.map((nodeModuleCandidate) => {
      return async () => {
        const packageFilename = nodeModuleCandidate
          ? `${rootFolder}/node_modules/${nodeModuleCandidate}/node_modules/${nodeModuleName}/package.json`
          : `${rootFolder}/node_modules/${nodeModuleName}/package.json`
        const packageData = await readPackageData({
          filename: packageFilename,
          returnNullWhenNotFound: true,
        })
        return { packageData, packageFilename }
      }
    }),
    null,
    ({ packageData }) => Boolean(packageData),
  )
}
