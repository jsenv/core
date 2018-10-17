import cuid from "cuid"
import { createETag, isFileNotFoundError, removeFolderDeep } from "./helpers.js"
import { readFile } from "./readFile.js"
import { writeFileFromString } from "@dmail/project-structure-compile-babel"
import {
  getCacheDataLocation,
  getBranchLocation,
  getOutputLocation,
  getOutputAssetLocation,
  getOutputName,
} from "./locaters.js"
import { lockForRessource } from "./ressourceRegistry.js"

const readBranchMain = ({
  root,
  cacheFolder,
  compileFolder,
  inputName,
  eTag,
  inputLocation,
  cache,
  branch,
}) => {
  return readFile({ location: inputLocation }).then(({ content }) => {
    const inputETag = createETag(content)

    return Promise.resolve()
      .then(() => {
        if (eTag) {
          if (eTag !== inputETag) {
            return { status: `remote eTag outdated` }
          }
          return { status: "valid" }
        }

        const eTagLocal = cache.eTag
        if (inputETag !== eTagLocal) {
          return { status: `local eTag outdated` }
        }

        const outputLocation = getOutputLocation({
          root,
          cacheFolder,
          compileFolder,
          inputName,
          branch,
        })
        return readFile({
          location: outputLocation,
          errorHandler: isFileNotFoundError,
        }).then(({ content, error }) => {
          if (error) {
            return { status: `cache not found at ${outputLocation}` }
          }
          return { status: "valid", output: content }
        })
      })
      .then(({ status, output }) => {
        return {
          input: content,
          inputETag,
          status,
          output,
        }
      })
  })
}

const readBranchAsset = ({ root, cacheFolder, compileFolder, inputName, cache, branch, asset }) => {
  const outputAssetLocation = getOutputAssetLocation({
    root,
    cacheFolder,
    compileFolder,
    inputName,
    branch,
    asset,
  })
  const name = asset.name

  return readFile({
    location: outputAssetLocation,
    errorHandler: isFileNotFoundError,
  }).then(({ content, error }) => {
    if (error) {
      return {
        status: `asset file not found ${outputAssetLocation}`,
        name,
      }
    }

    const actual = createETag(content)
    const expected = asset.eTag
    if (actual !== expected) {
      return {
        status: `unexpected ${asset.name} asset for ${cache.file}: unexpected eTag`,
        name,
        content,
      }
    }
    return {
      status: "valid",
      name,
      content,
    }
  })
}

const readBranch = ({
  root,
  cacheFolder,
  compileFolder,
  inputName,
  eTag,
  inputLocation,
  cache,
  branch,
}) => {
  return Promise.all([
    readBranchMain({
      root,
      cacheFolder,
      compileFolder,
      inputName,
      eTag,
      inputLocation,
      cache,
      branch,
    }),
    ...branch.outputAssets.map((outputAsset) => {
      return readBranchAsset({
        root,
        cacheFolder,
        compileFolder,
        inputName,
        cache,
        branch,
        asset: outputAsset,
      })
    }),
  ]).then(([mainData, ...assetsData]) => {
    const { status, input, inputETag, output } = mainData

    let computedStatus
    if (status === "valid") {
      const invalidAsset = assetsData.find((assetData) => assetData.status !== "valid")
      computedStatus = invalidAsset ? invalidAsset.status : "valid"
    } else {
      computedStatus = status
    }

    return {
      status: computedStatus,
      input,
      inputETag,
      output,
      outputAssets: assetsData,
    }
  })
}

const createCacheCorruptionError = (message) => {
  const error = new Error(message)
  error.code = "CACHE_CORRUPTION_ERROR"
  return error
}

const getFileBranch = ({
  compile,
  root,
  cacheFolder,
  compileFolder,
  inputName,
  locate,
  ...rest
}) => {
  const cacheDataLocation = getCacheDataLocation({
    root,
    cacheFolder,
    compileFolder,
    inputName,
  })

  return Promise.all([
    locate(inputName, root),
    readFile({
      location: cacheDataLocation,
      errorHandler: isFileNotFoundError,
    }).then(({ content, error }) => {
      if (error) {
        return {
          branches: [],
        }
      }
      const cache = JSON.parse(content)
      if (cache.inputName !== inputName) {
        throw createCacheCorruptionError(
          `${cacheDataLocation} corrupted: cache.inputName should be ${inputName}, got ${
            cache.inputName
          }`,
        )
      }
      return cache
    }),
  ])
    .then(([inputLocation, cache]) => {
      return {
        inputLocation,
        cache,
      }
    })
    .then(({ inputLocation, cache }) => {
      // here, if readFile returns ENOENT we could/should check is there is something in cache for that file
      // and take that chance to remove the cached version of that file
      // but it's not supposed to happen
      return readFile({
        location: inputLocation,
      }).then(({ content }) => {
        return compile({
          root,
          inputName,
          inputSource: content,
          ...rest,
        }).then(({ options, generate }) => {
          const branchIsValid = (branch) => {
            return JSON.stringify(branch.outputMeta) === JSON.stringify(options)
          }

          const cachedBranch = cache.branches.find((branch) => branchIsValid(branch))

          return {
            inputLocation,
            cache,
            options,
            generate,
            input: content,
            branch: cachedBranch,
          }
        })
      })
    })
}

const getFileReport = ({
  compile,
  locate,
  root,
  cacheFolder,
  compileFolder,
  inputName,
  eTag,
  ...rest
}) => {
  return getFileBranch({
    compile,
    locate,
    root,
    cacheFolder,
    compileFolder,
    inputName,
    eTag,
    ...rest,
  }).then(({ inputLocation, cache, options, generate, input, branch }) => {
    if (!branch) {
      return {
        inputLocation,
        status: "missing",
        cache,
        options,
        generate,
        branch: {
          name: cuid(),
        },
        input,
      }
    }

    return readBranch({
      root,
      cacheFolder,
      compileFolder,
      inputName,
      eTag,
      inputLocation,
      cache,
      branch,
    }).then(({ status, input, inputETag, output, outputAssets }) => {
      return {
        inputLocation,
        status,
        cache,
        options,
        generate,
        branch,
        input,
        inputETag,
        output,
        outputAssets,
      }
    })
  })
}

const compareBranch = (branchA, branchB) => {
  const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs

  if (lastMatchDiff === 0) {
    return branchA.matchCount - branchB.matchCount
  }
  return lastMatchDiff
}

const updateBranch = ({
  root,
  cacheFolder,
  compileFolder,
  inputName,
  inputLocation,
  status,
  cache,
  options,
  branch,
  inputETag,
  output,
  outputAssets,
  cacheTrackHit,
}) => {
  const { branches } = cache
  const isCached = status === "cached"
  const isNew = status === "created"
  const isUpdated = status === "updated"

  const promises = []

  if (isNew || isUpdated) {
    const mainLocation = getOutputLocation({
      root,
      cacheFolder,
      compileFolder,
      inputName,
      branch,
    })

    promises.push(
      writeFileFromString(mainLocation, output),
      ...outputAssets.map((asset) => {
        const assetLocation = getOutputAssetLocation({
          root,
          cacheFolder,
          compileFolder,
          inputName,
          branch,
          asset,
        })

        return writeFileFromString(assetLocation, asset.content)
      }),
    )
  }

  if (isNew || isUpdated || (isCached && cacheTrackHit)) {
    if (inputETag !== cache.eTag) {
      const branchesToRemove = branches.slice()
      // do not remove the updated branch
      const index = branchesToRemove.indexOf(branch)
      branchesToRemove.splice(index, 1)

      branchesToRemove.forEach((branch) => {
        const branchLocation = getBranchLocation({
          root,
          cacheFolder,
          compileFolder,
          inputName,
          branch,
        })
        console.log(`file changed, remove ${branchLocation}`)
        // the line below is async but non blocking
        removeFolderDeep(branchLocation)
      })
      branches.length = 0
      // do not remove updated branch
      if (isUpdated) {
        branches.push(branch)
      }
    }

    if (isNew) {
      branches.push(branch)
    }

    const updatedBranches = branches
      .map((branchToUpdate) => {
        if (branchToUpdate.name !== branch.name) {
          return { ...branchToUpdate }
        }
        if (isCached) {
          return {
            ...branchToUpdate,
            matchCount: branch.matchCount + 1,
            lastMatchMs: Number(Date.now()),
          }
        }
        if (isUpdated) {
          return {
            ...branchToUpdate,
            matchCount: branch.matchCount + 1,
            lastMatchMs: Number(Date.now()),
            lastModifiedMs: Number(Date.now()),
            outputAssets: outputAssets.map(({ name, content }) => {
              return { name, eTag: createETag(content) }
            }),
          }
        }
        // new branch
        return {
          name: branch.name,
          matchCount: 1,
          createdMs: Number(Date.now()),
          lastModifiedMs: Number(Date.now()),
          lastMatchMs: Number(Date.now()),
          outputMeta: options,
          outputAssets: outputAssets.map(({ name, content }) => {
            return { name, eTag: createETag(content) }
          }),
        }
      })
      .sort(compareBranch)

    const updatedCache = {
      inputName,
      eTag: isCached ? cache.eTag : inputETag,
      inputLocation,
      branches: updatedBranches,
    }

    const cacheDataLocation = getCacheDataLocation({
      root,
      cacheFolder,
      compileFolder,
      inputName,
    })

    promises.push(writeFileFromString(cacheDataLocation, JSON.stringify(updatedCache, null, "  ")))
  }

  return Promise.all(promises)
}

export const compileFile = ({
  compile,
  locate,
  root,
  cacheFolder,
  compileFolder,
  file,
  eTag,
  cacheTrackHit,
  cacheIgnore,
  ...rest
}) => {
  const inputName = file
  const fileLock = lockForRessource(
    getCacheDataLocation({
      root,
      cacheFolder,
      compileFolder,
      inputName,
    }),
  )

  return fileLock.chain(() => {
    return getFileReport({
      compile,
      locate,
      root,
      cacheFolder,
      compileFolder,
      inputName,
      eTag,
      ...rest,
    })
      .then(
        ({
          inputLocation,
          status,
          cache,
          options,
          generate,
          branch,
          input,
          inputETag,
          output,
          outputAssets,
        }) => {
          const outputName = getOutputName({
            cacheFolder,
            compileFolder,
            inputName,
            branch,
          })

          const remoteETagValid = !cacheIgnore && eTag && status === "valid"

          if (!cacheIgnore && status === "valid") {
            return {
              inputLocation,
              status: "cached",
              cache,
              options,
              branch,
              remoteETagValid,
              input,
              inputETag,
              outputName,
              output,
              outputAssets,
            }
          }

          return Promise.resolve(generate({ outputName, ...rest })).then(
            ({ output, outputAssets }) => {
              return {
                inputLocation,
                status: status === "missing" ? "created" : "updated",
                cache,
                options,
                branch,
                remoteETagValid,
                input,
                inputETag: createETag(input),
                outputName,
                output,
                outputAssets,
              }
            },
          )
        },
      )
      .then(
        ({
          inputLocation,
          status,
          cache,
          options,
          branch,
          remoteETagValid,
          input,
          inputETag,
          outputName,
          output,
          outputAssets,
        }) => {
          return updateBranch({
            root,
            cacheFolder,
            compileFolder,
            inputName,
            inputLocation,
            status,
            cache,
            options,
            branch,
            input,
            inputETag,
            output,
            outputAssets,
            cacheTrackHit,
          }).then(() => {
            return {
              status,
              remoteETagValid,
              inputETag,
              output,
              outputName,
              outputAssets,
              cacheIgnore,
            }
          })
        },
      )
  })
}
