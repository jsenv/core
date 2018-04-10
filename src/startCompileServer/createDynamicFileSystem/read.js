// https://github.com/jsenv/core/blob/master/src/api/util/store.js

import cuid from "cuid"
import path from "path"
import { all, passed } from "@dmail/action"
import { locate, JSON_FILE } from "./cache.js"
import {
  resolvePath,
  readFileAsString,
  isFileNotFoundError,
  createETag,
  writeFileFromString,
} from "./helpers.js"
import { enqueueCallByArgs } from "./enqueueCall.js"

const ressourceMap = new WeakMap()
const restoreByArgs = (file) => ressourceMap.get(file)
const memoizeArgs = (file, memoizedFn) => ressourceMap.set(file, memoizedFn)

const compareBranch = (branchA, branchB) => {
  const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs

  if (lastMatchDiff === 0) {
    return branchA.matchCount - branchB.matchCount
  }
  return lastMatchDiff
}

export const read = ({
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

  const inputLocation = locate(inputRelativeLocation, rootLocation)

  const getCacheDataLocation = () => resolvePath(cacheFolderLocation, JSON_FILE)

  const getBranchLocation = (branch) => resolvePath(cacheFolderLocation, branch.name)

  const getOutputLocation = (branch) =>
    resolvePath(getBranchLocation(branch), path.basename(inputRelativeLocation))

  const getOutputAssetLocation = (branch, asset) =>
    resolvePath(getBranchLocation(branch), asset.name)

  const readOutputCache = ({ branch, cache }) => {
    return readFileAsString({ location: inputLocation }).then((input) => {
      const actual = createETag(input)
      const expected = cache.eTag
      if (actual !== expected) {
        return {
          status: `eTag modified on ${inputLocation} since it was cached`,
          input,
        }
      }

      const outputLocation = getOutputLocation(branch)
      return readFileAsString({
        location: outputLocation,
        errorHandler: isFileNotFoundError,
      }).then(
        (output) => {
          return {
            status: "valid",
            input,
            output,
          }
        },
        () =>
          passed({
            status: `cache not found at ${outputLocation}`,
            input,
          }),
      )
    })
  }

  const readOutputAssetCache = ({ branch, asset }) => {
    const outputAssetLocation = getOutputAssetLocation(branch, asset)

    return readFileAsString({
      location: outputAssetLocation,
      errorHandler: isFileNotFoundError,
    }).then(
      (content) => {
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
      },
      () =>
        passed({
          status: `asset file not found ${outputAssetLocation}`,
        }),
    )
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

    return readFileAsString({ location: inputLocation }).then((input) => {
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

    Object.assign(cache, {
      inputRelativeLocation,
      inputETag: isCached ? cache.inputETag : createETag(data.output),
    })

    if (inputLocation !== resolvePath(rootLocation, inputRelativeLocation)) {
      cache.inputLocation = inputLocation
    }

    Object.assign(branch, {
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
    return readFileAsString({
      location: cacheDataLocation,
      errorHandler: isFileNotFoundError,
    })
      .then(
        (content) => {
          const cache = JSON.parse(content)
          if (cache.inputRelativeLocation !== inputRelativeLocation) {
            throw new Error(
              `${JSON_FILE} corrupted: unexpected inputRelativeLocation ${
                cache.inputRelativeLocation
              }, it must be ${inputRelativeLocation}`,
            )
          }
          return cache
        },
        () => passed({ inputRelativeLocation, branches: [] }),
      )
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
