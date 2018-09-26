/* eslint-disable import/max-dependencies */
import cuid from "cuid"
import path from "path"
import { URL } from "url"
import { createCompile } from "../createCompile/createCompile.js"
import { JSON_FILE } from "./cache.js"
import {
  createETag,
  isFileNotFoundError,
  resolvePath,
  removeFolderDeep,
  normalizeSeparation,
} from "./helpers.js"
import { locateFile } from "./locateFile.js"
import { readFile } from "./readFile.js"
import { lockForRessource } from "./ressourceRegistry.js"
import { writeFileFromString } from "@dmail/project-structure-compile-babel"
import { createFileService } from "../createFileService/createFileService.js"

const compareBranch = (branchA, branchB) => {
  const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs

  if (lastMatchDiff === 0) {
    return branchA.matchCount - branchB.matchCount
  }
  return lastMatchDiff
}

const getInputRelativeLocation = ({ abstractFolderRelativeLocation, filename }) => {
  // 'compiled/folder/file.js' -> 'folder/file.js'
  return filename.slice(abstractFolderRelativeLocation.length + 1)
}

const getCacheFolderLocation = ({ rootLocation, cacheFolderRelativeLocation, ...rest }) => {
  return resolvePath(rootLocation, cacheFolderRelativeLocation, getInputRelativeLocation(rest))
}

const getCacheDataLocation = (param) => {
  return resolvePath(getCacheFolderLocation(param), JSON_FILE)
}

const getBranchRelativeLocation = ({ cacheFolderRelativeLocation, branch, ...rest }) => {
  return resolvePath(cacheFolderRelativeLocation, getInputRelativeLocation(rest), branch.name)
}

const getOutputRelativeLocation = ({ filename, ...rest }) => {
  return resolvePath(getBranchRelativeLocation({ filename, ...rest }), path.basename(filename))
}

const getBranchLocation = ({ rootLocation, ...rest }) => {
  return resolvePath(rootLocation, getBranchRelativeLocation(rest))
}

const getOutputLocation = ({ rootLocation, ...rest }) => {
  return resolvePath(rootLocation, getOutputRelativeLocation(rest))
}

const getOutputAssetLocation = ({ asset, ...rest }) => {
  return resolvePath(getBranchLocation(rest), asset.name)
}

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

const getSourceAbstractLocation = ({ rootLocation, inputRelativeLocation }) =>
  resolvePath(rootLocation, inputRelativeLocation)

const getSourceMapLocation = ({ rootLocation, outputRelativeLocation, outputSourceMapName }) =>
  resolvePath(rootLocation, path.dirname(outputRelativeLocation), outputSourceMapName)

const sourceMapKnowsExactLocation = false

const getSourceMapAbstractpLocation = ({
  rootLocation,
  abstractFolderRelativeLocation,
  inputRelativeLocation,
  outputSourceMapName,
}) =>
  resolvePath(
    rootLocation,
    abstractFolderRelativeLocation,
    path.dirname(inputRelativeLocation),
    outputSourceMapName,
  )

const getFileBranch = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  compile,
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
          getSourceNameForSourceMap: () => {
            return filename
          },
          getSourceLocationForSourceMap: (context) => {
            const sourceMapUseAbsoluteLocation = true

            if (sourceMapUseAbsoluteLocation) {
              return `/${context.inputRelativeLocation}`
            }

            const sourceLocation = getSourceAbstractLocation(context)
            const sourceMapLocation = sourceMapKnowsExactLocation
              ? getSourceMapLocation(context)
              : getSourceMapAbstractpLocation(context)
            const sourceLocationRelativeToSourceMapLocation = normalizeSeparation(
              path.relative(path.dirname(sourceMapLocation), sourceLocation),
            )

            return sourceLocationRelativeToSourceMapLocation
          },
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
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  inputETagClient = null,
  compile,
}) => {
  return getFileBranch({
    rootLocation,
    cacheFolderRelativeLocation,
    abstractFolderRelativeLocation,
    filename,
    compile,
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
    }).then(({ status, input, output, outputAssets }) => {
      return {
        inputLocation,
        status,
        cache,
        options,
        generate,
        branch,
        input,
        output,
        outputAssets,
      }
    })
  })
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
  cacheAutoClean,
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
    if (cacheAutoClean) {
      if (inputETag !== cache.inputETag) {
        const branchesToRemove = branches.slice()

        // no need to remove the updated branch
        const index = branchesToRemove.indexOf(branch)
        branchesToRemove.splice(index, 1)

        branches.length = 0
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
        inputLocation === resolvePath(rootLocation, inputRelativeLocation)
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

const getFileCompiled = ({
  rootLocation,
  cacheFolderRelativeLocation,
  abstractFolderRelativeLocation,
  filename,
  compile,
  inputETagClient,
  cacheEnabled,
  cacheAutoClean,
  cacheTrackHit,
}) => {
  const fileLock = lockForRessource(
    getCacheDataLocation({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
    }),
  )

  return fileLock.chain(() => {
    return getFileReport({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      compile,
      inputETagClient,
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
          if (cacheEnabled === false) {
            status = "missing"
          }

          const outputRelativeLocation = getOutputRelativeLocation({
            cacheFolderRelativeLocation,
            abstractFolderRelativeLocation,
            filename,
            branch,
          })

          if (status === "valid") {
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

          return Promise.resolve(generate({ outputRelativeLocation })).then(
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
            rootLocation,
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
            cacheAutoClean,
          }).then(() => {
            return {
              status,
              inputETag,
              output,
              outputRelativeLocation,
            }
          })
        },
      )
  })
}

export const createCompileService = ({
  rootLocation,
  cacheFolderRelativeLocation = "build",
  abstractFolderRelativeLocation = "compiled",
  compile = createCompile(),
  cacheEnabled = false,
  cacheAutoClean = true,
  cacheTrackHit = false,
}) => {
  const fileService = createFileService()

  const service = ({ method, url, headers }) => {
    const pathname = url.pathname
    // '/compiled/folder/file.js' -> 'compiled/folder/file.js'
    const filename = pathname.slice(1)

    // je crois, que, normalement
    // il faudrait "aider" le browser pour que tout ça ait du sens
    // genre lui envoyer une redirection vers le fichier en cache
    // genre renvoyer 201 vers le cache lorsqu'il a été update ou créé
    // https://developer.mozilla.org/fr/docs/Web/HTTP/Status/201
    // renvoyer 302 ou 307 lorsque le cache existe
    // l'intérêt c'est que si jamais le browser fait une requête vers le cache
    // il sait à quoi ça correspond vraiment
    // par contre ça fait 2 requête http

    if (filename.endsWith(".map")) {
      const fileLock = lockForRessource(
        getCacheDataLocation({
          rootLocation,
          cacheFolderRelativeLocation,
          abstractFolderRelativeLocation,
          filename,
        }),
      )

      return fileLock.chain(() => {
        const script = filename.slice(0, -4) // 'folder/file.js.map' -> 'folder.file.js'

        // if we receive something like compiled/folder/file.js.map
        // we redirect to build/folder/file.js/jqjcijjojio/file.js.map

        return getFileBranch({
          rootLocation,
          cacheFolderRelativeLocation,
          abstractFolderRelativeLocation,
          filename: script,
          compile,
        }).then(
          ({ branch }) => {
            if (!branch) {
              return {
                status: 404,
              }
            }

            const scriptCompiledFolder = resolvePath(
              rootLocation,
              getBranchRelativeLocation({
                cacheFolderRelativeLocation,
                abstractFolderRelativeLocation,
                filename: script,
                branch,
              }),
            )

            return fileService({
              method,
              url: new URL(
                `file:///${scriptCompiledFolder}/${path.basename(filename)}${url.search}`,
              ),
              headers,
            })
          },
          (error) => {
            if (error && error.reason === "Unexpected directory operation") {
              return {
                status: 403,
              }
            }
            return Promise.reject(error)
          },
        )
      })
    }

    return getFileCompiled({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename,
      compile,
      inputETagClient: headers.has("if-none-match") ? headers.get("if-none-match") : undefined,
      cacheEnabled,
      cacheAutoClean,
      cacheTrackHit,
    }).then(
      ({ status, inputETag, outputRelativeLocation, output }) => {
        // here status can be "created", "updated", "cached"

        // c'est un peu optimiste ici de se dire que si c'est cached et qu'on a
        // if-none-match c'est forcément le etag du client qui a match
        // faudra changer ça non?
        if (headers.has("if-none-match") && status === "cached") {
          return {
            status: 304,
            headers: {
              "cache-control": "no-store",
              "x-location": outputRelativeLocation,
            },
          }
        }

        return {
          status: 200,
          headers: {
            Etag: inputETag,
            "content-length": Buffer.byteLength(output),
            "content-type": "application/javascript",
            "cache-control": "no-store",
            "x-location": outputRelativeLocation,
          },
          body: output,
        }
      },
      (error) => {
        if (error && error.reason === "Unexpected directory operation") {
          return {
            status: 403,
          }
        }
        return Promise.reject(error)
      },
    )
  }

  const compileFile = (relativeLocation) =>
    getFileCompiled({
      rootLocation,
      cacheFolderRelativeLocation,
      abstractFolderRelativeLocation,
      filename: `${abstractFolderRelativeLocation}/${relativeLocation}`,
      compile,
      cacheEnabled,
      cacheAutoClean,
      cacheTrackHit,
    })

  return { service, compileFile }
}
