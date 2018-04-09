// https://github.com/jsenv/core/blob/master/src/api/util/store.js

import cuid from "cuid"
import path from "path"
import { all, passed } from "@dmail/action"
import { resolvePath } from "../../resolvePath.js"
import { getFileContent, getFileContentOr } from "./helpers.js"
import { createETag } from "./createETag.js"
import { writeFileFromString } from "../../writeFileFromString.js"
import { enqueueCallByArgs } from "./enqueueCall.js"

const ressourceMap = new WeakMap()
const restoreByArgs = (file) => ressourceMap.get(file)
const memoizeArgs = (file, memoizedFn) => ressourceMap.set(file, memoizedFn)

const defaultCache = `{
  "inputLocation": "",
  "inputETag": "",
  "outputMeta": {},
  "branches": [],
}`

const compareBranch = (branchA, branchB) => {
  const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs

  if (lastMatchDiff === 0) {
    return branchA.matchCount - branchB.matchCount
  }
  return lastMatchDiff
}

export const createCache = ({
  rootLocation,
  cacheFolderRelativeLocation,
  inputRelativeLocation,
  generate,
  outputMeta = {},
  trackHit = false,
}) => {
  const cacheFolderLocation = resolvePath(
    rootLocation,
    cacheFolderRelativeLocation,
    inputRelativeLocation,
  )

  const getCacheDataLocation = () => resolvePath(cacheFolderLocation, "cache.json")

  const getBranchLocation = (branch) => resolvePath(cacheFolderLocation, branch.name)

  const getOutputLocation = (branch) =>
    resolvePath(getBranchLocation(branch), path.basename(inputRelativeLocation))

  const getOutputAssetLocation = (branch, asset) =>
    resolvePath(getBranchLocation(branch), asset.name)

  const getInputLocation = () => resolvePath(rootLocation, inputRelativeLocation)

  const readOutputCache = ({ branch, cache }) => {
    const inputLocation = getInputLocation()
    return getFileContent(inputLocation).then((input) => {
      const actual = createETag(input)
      const expected = cache.eTag
      if (actual !== expected) {
        return {
          status: `eTag modified on ${inputLocation} since it was cached`,
          input,
        }
      }

      const outputLocation = getOutputLocation(branch)
      return getFileContentOr(outputLocation, null).then((output) => {
        if (output === null) {
          return {
            status: `cache not found at ${outputLocation}`,
            input,
          }
        }
        return {
          status: "valid",
          input,
          output,
        }
      })
    })
  }

  const readOutputAssetCache = ({ branch, asset }) => {
    const outputAssetLocation = getOutputAssetLocation(branch, asset)

    return getFileContentOr(outputAssetLocation, null).then((content) => {
      if (content === null) {
        return {
          status: `asset file not found ${outputAssetLocation}`,
        }
      }
      const actual = createETag(content)
      const expected = asset.eTag
      if (actual !== expected) {
        return {
          status: `unexpected ${asset.name} asset for ${inputRelativeLocation}: unexpected eTag`,
          content,
        }
      }
      return {
        status: "valid",
        content,
      }
    })
  }

  const readBranch = ({ branch, cache }) => {
    return all([
      readOutputCache({ branch, cache }),
      ...branch.outputAssets.map((outputAsset) => readOutputAssetCache({ branch, outputAsset })),
    ]).then(([outputData, ...outputAssetsData]) => {
      const data = {
        input: outputData.input,
        output: outputData.output,
        outputAssets: branch.outputAssets.map(({ name }, index) => {
          return {
            name,
            content: outputAssetsData[index].content,
          }
        }),
      }

      let computedStatus
      if (outputData.status === "valid") {
        const invalidOutputAsset = outputAssetsData.find(
          (outputAsset) => outputAsset.status !== "valid",
        )
        computedStatus = invalidOutputAsset ? invalidOutputAsset.status : "valid"
      } else {
        computedStatus = outputData.status
      }

      return {
        status: computedStatus,
        data,
      }
    })
  }

  const getFromCacheOrGenerate = ({ cache }) => {
    const branchIsValid = (branch) => {
      return JSON.stringify(branch.outputMeta) === JSON.stringify(outputMeta)
    }

    const cachedBranch = cache.branches.find((branch) => branchIsValid(branch))
    if (cachedBranch) {
      const branch = cachedBranch
      return readBranch({ cache, branch }).then(({ status, data }) => {
        if (status === "valid") {
          return {
            status: "cached",
            branch,
            data,
          }
        }
        const { input } = data
        return generate(input).then((result) => {
          return {
            status: "updated",
            branch,
            data: { input, ...result },
          }
        })
      })
    }

    return getFileContent(getInputLocation()).then((input) => {
      return generate(input).then((result) => {
        return {
          status: "generated",
          branch: { name: cuid() },
          data: { input, ...result },
        }
      })
    })
  }

  const update = ({ cache, status, branch, data }) => {
    const { branches } = cache
    const isCached = status === "cached"
    const isNew = status === "generated"
    const isUpdated = status === "updated"

    if (isCached && !trackHit) {
      return passed()
    }

    Object.assign(branch, {
      inputLocation: getInputLocation(),
      inputETag: isCached ? branch.inputETag : createETag(data.output),
      matchCount: isCached ? branch.matchCount + 1 : 1,
      createdMs: isNew ? Number(Date.now()) : branch.createdMs,
      lastModifiedMs: isCached ? branch.lastModifiedMs : Number(Date.now()),
      lastMatchMs: Number(Date.now()),
      outputMeta,
      outputAssets: isCached
        ? branch.outputAssets
        : data.outputAssets.map(({ name, content }) => {
            return { name, eTag: createETag(content) }
          }),
    })

    if (isNew) {
      branches.push(branch)
    }

    const actions = []

    if (isNew || isUpdated) {
      actions.push(
        writeFileFromString({
          location: getOutputLocation(branch),
          string: data.output,
        }),
        ...data.outputAssets.map((asset) =>
          writeFileFromString({
            location: getOutputAssetLocation(branch, asset),
            string: asset.content,
          }),
        ),
      )
    }

    actions.push(
      writeFileFromString({
        location: getCacheDataLocation(cache),
        string: JSON.stringify({ ...cache, branches: branches.sort(compareBranch) }, null, "\t"),
      }),
    )

    return all(actions)
  }

  const read = (cacheDataLocation) => {
    return getFileContentOr(cacheDataLocation, defaultCache)
      .then(JSON.parse)
      .then((cache) => {
        return getFromCacheOrGenerate(cache).then(({ status, branch, data }) => {
          return update({ cache, status, branch, data }).then(() => data)
        })
      })
  }

  return enqueueCallByArgs({
    fn: read,
    restoreByArgs,
    memoizeArgs,
  })(getCacheDataLocation())
}
