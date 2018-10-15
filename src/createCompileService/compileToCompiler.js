/* eslint-disable import/max-dependencies */
import cuid from "cuid"
import { JSON_FILE } from "./cache.js"
import { createETag, isFileNotFoundError, removeFolderDeep } from "./helpers.js"
import { locateFile } from "./locateFile.js"
import { readFile } from "./readFile.js"
import { lockForRessource } from "./ressourceRegistry.js"
import { writeFileFromString } from "@dmail/project-structure-compile-babel"
import {
  getInputRelativeLocation,
  getCacheDataLocation,
  getOutputRelativeLocation,
  getBranchLocation,
  getOutputLocation,
  getOutputAssetLocation,
  getSourceAbstractLocation,
} from "./locaters.js"

const readBranchMain = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  inputLocation,
  inputETagClient,
  cache,
  branch,
}) => {
  return readFile({ location: inputLocation }).then(({ content }) => {
    const inputETag = createETag(content)

    return Promise.resolve()
      .then(() => {
        // faudra pouvoir désactiver ce check lorsqu'on veut juste connaitre l'état du cache
        if (inputETagClient) {
          if (inputETag !== inputETagClient) {
            return {
              status: `eTag modified on ${inputLocation} since it was cached by client`,
              inputETagClient,
            }
          }
          return { status: "valid" }
        }

        const inputETagCached = cache.inputETag
        if (inputETag !== inputETagCached) {
          return {
            status: `eTag modified on ${inputLocation} since it was cached on filesystem`,
            inputETagCached,
          }
        }

        const outputLocation = getOutputLocation({
          rootLocation,
          cacheFolderRelativeLocation,
          abstractFolderRelativeLocation,
          filename,
          branch,
        })
        return readFile({
          location: outputLocation,
          errorHandler: isFileNotFoundError,
        }).then(({ content, error }) => {
          if (error) {
            return {
              status: `cache not found at ${outputLocation}`,
            }
          }
          return { status: "valid", output: content }
        })
      })
      .then((moreData) => {
        return {
          input: content,
          inputETag,
          ...moreData,
        }
      })
  })
}

const readBranchAsset = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  cache,
  branch,
  asset,
}) => {
  const outputAssetLocation = getOutputAssetLocation({
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename,
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
        status: `unexpected ${asset.name} asset for ${
          cache.inputRelativeLocation
        }: unexpected eTag`,
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
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  inputLocation,
  inputETagClient,
  cache,
  branch,
}) => {
  return Promise.all([
    readBranchMain({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      inputLocation,
      inputETagClient,
      cache,
      branch,
    }),
    ...branch.outputAssets.map((outputAsset) => {
      return readBranchAsset({
        rootLocation,
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        filename,
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

const getFileBranch = ({
  compile,
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  ...rest
}) => {
  const inputRelativeLocation = getInputRelativeLocation({
    abstractFolderRelativeLocation,
    filename,
  })

  const cacheDataLocation = getCacheDataLocation({
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename,
  })

  return Promise.all([
    locateFile(inputRelativeLocation, rootLocation),
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
      if (cache.inputRelativeLocation !== inputRelativeLocation) {
        throw new Error(
          `${JSON_FILE} corrupted: unexpected inputRelativeLocation ${
            cache.inputRelativeLocation
          }, it must be ${inputRelativeLocation}`,
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
          rootLocation,
          abstractFolderRelativeLocation,
          inputRelativeLocation,
          inputSource: content,
          filename,
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
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  inputETagClient = null,
  ...rest
}) => {
  return getFileBranch({
    compile,
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename,
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
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      inputLocation,
      inputETagClient,
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
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
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
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      branch,
    })

    promises.push(
      writeFileFromString(mainLocation, output),
      ...outputAssets.map((asset) => {
        const assetLocation = getOutputAssetLocation({
          rootLocation,
          cacheFolderRelativeLocation,
          abstractFolderRelativeLocation,
          filename,
          branch,
          asset,
        })

        return writeFileFromString(assetLocation, asset.content)
      }),
    )
  }

  if (isNew || isUpdated || (isCached && cacheTrackHit)) {
    if (inputETag !== cache.inputETag) {
      const branchesToRemove = branches.slice()
      // do not remove the updated branch
      const index = branchesToRemove.indexOf(branch)
      branchesToRemove.splice(index, 1)

      branchesToRemove.forEach((branch) => {
        const branchLocation = getBranchLocation({
          rootLocation,
          cacheFolderRelativeLocation,
          abstractFolderRelativeLocation,
          filename,
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

    const inputRelativeLocation = getInputRelativeLocation({
      abstractFolderRelativeLocation,
      filename,
    })

    const updatedCache = {
      inputRelativeLocation,
      inputETag: isCached ? cache.inputETag : inputETag,
      inputLocation:
        inputLocation === getSourceAbstractLocation({ rootLocation, inputRelativeLocation })
          ? undefined
          : inputLocation,
      branches: updatedBranches,
    }

    const cacheDataLocation = getCacheDataLocation({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
    })

    promises.push(writeFileFromString(cacheDataLocation, JSON.stringify(updatedCache, null, "  ")))
  }

  return Promise.all(promises)
}

export const compileToCompiler = ({
  compile,
  root,
  cacheFolderRelativeLocation = "build",
  abstractFolderRelativeLocation = "compiled",
  cacheDisabled = false,
  cacheTrackHit = false,
}) => {
  const getFileCompiled = ({ file, eTag, ...rest }) => {
    const filename = `${abstractFolderRelativeLocation}/${file}`
    const inputETagClient = eTag

    const fileLock = lockForRessource(
      getCacheDataLocation({
        rootLocation: root,
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        filename: file,
      }),
    )

    return fileLock.chain(() => {
      return getFileReport({
        compile,
        rootLocation: root,
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        filename,
        inputETagClient,
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
            const outputRelativeLocation = getOutputRelativeLocation({
              cacheFolderRelativeLocation,
              abstractFolderRelativeLocation,
              filename,
              branch,
            })

            if (!cacheDisabled && status === "valid") {
              return {
                inputLocation,
                status: "cached",
                cache,
                options,
                branch,
                input,
                inputETag,
                outputRelativeLocation,
                output,
                outputAssets,
              }
            }

            return Promise.resolve(generate({ outputRelativeLocation, ...rest })).then(
              ({ output, outputAssets }) => {
                return {
                  inputLocation,
                  status: status === "missing" ? "created" : "updated",
                  cache,
                  options,
                  branch,
                  input,
                  inputETag: createETag(input),
                  outputRelativeLocation,
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
            input,
            inputETag,
            outputRelativeLocation,
            output,
            outputAssets,
          }) => {
            return updateBranch({
              rootLocation: root,
              cacheFolderRelativeLocation,
              abstractFolderRelativeLocation,
              filename,
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
                inputETag,
                output,
                outputRelativeLocation,
                cacheDisabled,
              }
            })
          },
        )
    })
  }

  const getFileCompiledAssetLocation = ({ file, asset, ...rest }) => {
    const filename = `${abstractFolderRelativeLocation}/${file}`

    return getFileBranch({
      compile,
      rootLocation: root,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      ...rest,
    }).then(({ branch }) => {
      if (!branch) {
        return ""
      }

      const branchLocation = getBranchLocation({
        rootLocation: root,
        cacheFolderRelativeLocation,
        abstractFolderRelativeLocation,
        branch,
      })

      return `file:///${branchLocation}${asset}`
    })
  }

  return { getFileCompiled, getFileCompiledAssetLocation }
}
