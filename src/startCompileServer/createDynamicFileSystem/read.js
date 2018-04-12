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
  readFile = readFileAsString,
  writeFile = writeFileFromString,
  inputETag,
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

  const readOutputCache = ({ branch, cache, statusOnly = false }) => {
    return readFile({ location: inputLocation }).then(({ content }) => {
      const inputETag = createETag(content)
      const cachedInputEtag = cache.inputETag

      const data = {
        input: content,
        inputETag,
      }

      if (inputETag !== cachedInputEtag) {
        return {
          ...data,
          status: `eTag modified on ${inputLocation} since it was cached`,
          cachedInputEtag,
        }
      }

      if (statusOnly) {
        return {
          ...data,
          status: "valid",
        }
      }

      const outputLocation = getOutputLocation(branch)
      return readFile({
        location: outputLocation,
        errorHandler: isFileNotFoundError,
      }).then(({ output, error }) => {
        if (error) {
          return {
            ...data,
            status: `cache not found at ${outputLocation}`,
          }
        }
        return { ...data, status: "valid", output }
      })
    })
  }

  const readOutputAssetCache = ({ branch, asset }) => {
    const outputAssetLocation = getOutputAssetLocation(branch, asset)

    return readFile({
      location: outputAssetLocation,
      errorHandler: isFileNotFoundError,
    }).then(({ content, error }) => {
      if (error) {
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

  const readBranch = ({ branch, cache, statusOnly }) => {
    return all([
      readOutputCache({ branch, cache, statusOnly }),
      ...branch.outputAssets.map((outputAsset) => readOutputAssetCache({ branch, outputAsset })),
    ]).then(([outputData, ...outputAssetsData]) => {
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
        ...outputData,
        outputAssets: branch.outputAssets.map(({ name }, index) => {
          return {
            name,
            content: outputAssetsData[index].content,
          }
        }),
        status: computedStatus,
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
      return readBranch({ cache, branch, statusOnly: Boolean(inputETag) }).then((data) => {
        if (data.status === "valid") {
          return {
            branch,
            data: {
              ...data,
              status: "cached",
            },
          }
        }
        return generate(data.input).then((result) => {
          return {
            branch,
            data: {
              ...data,
              status: "updated",
              inputETag: createETag(data.input),
              ...result,
            },
          }
        })
      })
    }

    return readFile({ location: inputLocation }).then((input) => {
      return generate(input).then((result) => {
        return {
          branch: { name: cuid() },
          data: {
            status: "generated",
            input,
            inputETag: createETag(input),
            ...result,
          },
        }
      })
    })
  }

  const update = ({ cache, branch, data }) => {
    const { branches } = cache
    const { status } = data
    const isCached = status === "cached"
    const isNew = status === "generated"
    const isUpdated = status === "updated"

    if (isCached && !trackHit) {
      return passed()
    }

    Object.assign(cache, {
      inputRelativeLocation,
      inputETag: isCached ? cache.inputETag : data.inputETag,
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
        writeFile({
          location: getOutputLocation(branch),
          string: data.output,
        }),
        ...data.outputAssets.map((asset) =>
          writeFile({
            location: getOutputAssetLocation(branch, asset),
            string: asset.content,
          }),
        ),
      )
    }

    actions.push(
      writeFile({
        location: getCacheDataLocation(cache),
        string: JSON.stringify({ ...cache, branches: branches.sort(compareBranch) }, null, "\t"),
      }),
    )

    return all(actions)
  }

  const read = (cacheDataLocation) => {
    return readFile({
      location: cacheDataLocation,
      errorHandler: isFileNotFoundError,
    })
      .then(({ content, error }) => {
        if (error) {
          return {
            inputRelativeLocation,
            branches: [],
          }
        }
        const cache = JSON.parse(content)
        if (cache.inputRelativeLocation !== inputRelativeLocation) {
          throw new Error(
            `${JSON_FILE} corrupted: unexpected inputRelativeLocation ${
              cache.inputRelativeLocation
            }, it must be ${inputRelativeLocation}`,
          )
        }
        return cache
      })
      .then((cache) => {
        return getFromCacheOrGenerate(cache).then(({ branch, data }) => {
          return update({ cache, branch, data }).then(() => {
            return data
          })
        })
      })
  }

  return enqueueCallByArgs({
    fn: read,
    restoreByArgs,
    memoizeArgs,
  })(getCacheDataLocation())
}
