import { all } from "@dmail/action"
import { getCacheLocation, readCache, readBranch } from "./cache.js"
import { readFolder } from "./helpers.js"

export const inspect = ({ rootLocation, relativeLocation }) => {
  const cacheAbsoluteLocation = getCacheLocation({
    rootLocation,
    relativeLocation,
  })

  return all([readCache(cacheAbsoluteLocation), readFolder(cacheAbsoluteLocation)]).then(
    ([cache, files]) => {
      const { branches } = cache

      return all(
        branches.map((branch) => readBranch({ cache, branch, allowMissingStatic: true })),
      ).then((branchesData) => {
        const validBranches = branches.filter((branch, index) => branchesData[index].valid)

        const getDynamicFileBranch = (file) => {
          return branches.find((branch) => branch.name === file)
        }
        const getAssetBranch = (file) => {
          return validBranches.find((branch) => branch.assets.some(({ name }) => name === file))
        }
        const branchIsValid = (branch) => {
          const index = branches.indexOf(branch)
          return branchesData[index].valid
        }

        return {
          cache,
          files,
          filesStatus: files.map((file) => {
            const dynamicFileBranch = getDynamicFileBranch(file)
            if (dynamicFileBranch) {
              return `dynamic-file-${
                branchIsValid(dynamicFileBranch) ? "valid" : "invalid"
              }-reference`
            }
            const assetBranch = getAssetBranch(file)
            if (assetBranch) {
              return `asset-${branchIsValid(dynamicFileBranch) ? "valid" : "invalid"}-reference`
            }
            return "no-reference"
          }),
          branches,
          branchesStatus: branches.map((branch, index) => {
            const { valid, reason } = branchesData[index]
            if (valid) {
              return "valid"
            }
            return reason
          }),
        }
      })
    },
  )
}
