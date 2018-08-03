// https://github.com/jsenv/core/blob/master/src/api/util/store.js

/* eslint-disable import/max-dependencies */
import cuid from "cuid"
import path from "path"
import { URL } from "url"
import { createCompile } from "../createCompile/createCompile.js"
import { createHeaders } from "../openServer/createHeaders.js"
import { JSON_FILE } from "./cache.js"
import { createETag, isFileNotFoundError, resolvePath } from "./helpers.js"
import { locateFile } from "./locateFile.js"
import { readFile } from "./readFile.js"
import { lockForRessource } from "./ressourceRegistry.js"
import { writeFile } from "./writeFile.js"
import { createFileService } from "../createFileService/createFileService.js"

const compareBranch = (branchA, branchB) => {
  const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs

  if (lastMatchDiff === 0) {
    return branchA.matchCount - branchB.matchCount
  }
  return lastMatchDiff
}

const getInputRelativeLocation = ({ compiledFolderRelativeLocation, filename }) => {
  // 'compiled/folder/file.js' -> 'folder/file.js'
  return filename.slice(compiledFolderRelativeLocation.length + 1)
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
  compiledFolderRelativeLocation,
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
          compiledFolderRelativeLocation,
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
  compiledFolderRelativeLocation,
  filename,
  cache,
  branch,
  asset,
}) => {
  const outputAssetLocation = getOutputAssetLocation({
    rootLocation,
    cacheFolderRelativeLocation,
    compiledFolderRelativeLocation,
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
  compiledFolderRelativeLocation,
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
      compiledFolderRelativeLocation,
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
        compiledFolderRelativeLocation,
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

// faut trouver un moyen d'apeller cette fonction de l'extérieur
// faut aussi que cette fonction utilise enqueueCallByArgs
// je pense que je vais simplifier l'api de enqueueCallByArgs
// ca ressemblera plus à quelque chose à voir enqueueCall.js
const getFileReport = ({
  rootLocation,
  cacheFolderRelativeLocation,
  compiledFolderRelativeLocation,
  filename,
  compile,
  inputETagClient = null,
}) => {
  const inputRelativeLocation = getInputRelativeLocation({
    compiledFolderRelativeLocation,
    filename,
  })

  const cacheDataLocation = getCacheDataLocation({
    rootLocation,
    cacheFolderRelativeLocation,
    compiledFolderRelativeLocation,
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
      return readFile({ location: inputLocation }).then(({ content }) => {
        return compile({
          rootLocation,
          cacheFolderRelativeLocation,
          compiledFolderRelativeLocation,
          inputRelativeLocation,
          inputSource: content,
        }).then(({ options, generate }) => {
          const branchIsValid = (branch) => {
            return JSON.stringify(branch.outputMeta) === JSON.stringify(options)
          }

          const cachedBranch = cache.branches.find((branch) => branchIsValid(branch))
          if (!cachedBranch) {
            return {
              status: "missing",
              inputLocation,
              cache,
              options,
              generate,
              input: content,
            }
          }

          const branch = cachedBranch
          return readBranch({
            rootLocation,
            cacheFolderRelativeLocation,
            compiledFolderRelativeLocation,
            filename,
            inputLocation,
            inputETagClient,
            cache,
            branch,
          }).then(({ status, input, output, outputAssets }) => {
            return {
              status,
              inputLocation,
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
      })
    })
}

const update = ({
  status,
  rootLocation,
  cacheFolderRelativeLocation,
  compiledFolderRelativeLocation,
  filename,
  inputLocation,
  cache,
  options,
  branch,
  inputETag,
  output,
  outputAssets,
  trackHit,
}) => {
  const { branches } = cache
  const isCached = status === "cached"
  const isNew = status === "created"
  const isUpdated = status === "updated"

  // ici on devrait prendre cache.branches
  // et vérifier la validité de toutes les branches
  // chaque branche non valid serait supprimé
  // pour éviter que le cache grossisse indéfiniment

  if (isCached && !trackHit) {
    return Promise.resolve()
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
    compiledFolderRelativeLocation,
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

  const promises = []

  if (isNew || isUpdated) {
    const mainLocation = getOutputLocation({
      rootLocation,
      cacheFolderRelativeLocation,
      compiledFolderRelativeLocation,
      filename,
      branch,
    })

    promises.push(
      writeFile({
        location: mainLocation,
        string: output,
      }),
      ...outputAssets.map((asset) => {
        const assetLocation = getOutputAssetLocation({
          rootLocation,
          cacheFolderRelativeLocation,
          compiledFolderRelativeLocation,
          filename,
          branch,
          asset,
        })
        return writeFile({
          location: assetLocation,
          string: asset.content,
        })
      }),
    )
  }

  const cacheDataLocation = getCacheDataLocation({
    rootLocation,
    cacheFolderRelativeLocation,
    compiledFolderRelativeLocation,
    filename,
  })

  promises.push(
    writeFile({
      location: cacheDataLocation,
      string: JSON.stringify(updatedCache, null, "  "),
    }),
  )

  return Promise.all(promises)
}

const getScriptCompiled = ({
  rootLocation,
  cacheFolderRelativeLocation,
  compiledFolderRelativeLocation,
  filename,
  compile,
  inputETagClient,
  cacheEnabled,
  trackHit,
}) => {
  return getFileReport({
    rootLocation,
    cacheFolderRelativeLocation,
    compiledFolderRelativeLocation,
    filename,
    compile,
    inputETagClient,
  })
    .then(
      ({
        status,
        inputLocation,
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

        if (status === "valid") {
          return {
            status: "cached",
            inputLocation,
            cache,
            options,
            branch,
            input,
            inputETag,
            output,
            outputAssets,
          }
        }

        const outputRelativeLocation = getOutputRelativeLocation({
          cacheFolderRelativeLocation,
          compiledFolderRelativeLocation,
          filename,
          branch,
        })

        if (status !== "missing") {
          return Promise.resolve(generate({ outputRelativeLocation })).then(
            ({ output, outputAssets }) => {
              return {
                status: "updated",
                inputLocation,
                cache,
                options,
                branch,
                input,
                inputETag: createETag(input),
                output,
                outputAssets,
              }
            },
          )
        }

        return Promise.resolve(generate({ outputRelativeLocation })).then(
          ({ output, outputAssets }) => {
            return {
              status: "created",
              inputLocation,
              cache,
              options,
              branch: {
                name: cuid(),
              },
              input,
              inputETag: createETag(input),
              output,
              outputAssets,
            }
          },
        )
      },
    )
    .then(
      ({
        status,
        inputLocation,
        cache,
        options,
        branch,
        input,
        inputETag,
        output,
        outputAssets,
      }) => {
        return update({
          status,
          inputLocation,
          cache,
          options,
          branch,
          input,
          inputETag,
          output,
          outputAssets,
          trackHit,
        }).then(() => {
          return {
            status,
            inputETag,
            output,
          }
        })
      },
    )
}

const locateScriptCompiledFolder = ({
  rootLocation,
  cacheFolderRelativeLocation,
  compiledFolderRelativeLocation,
  filename,
  compile,
}) => {
  return getFileReport({
    rootLocation,
    cacheFolderRelativeLocation,
    compiledFolderRelativeLocation,
    filename,
    compile,
  }).then(({ branch }) => {
    return resolvePath(
      rootLocation,
      getBranchRelativeLocation({
        cacheFolderRelativeLocation,
        compiledFolderRelativeLocation,
        filename,
        branch,
      }),
    )
  })
}

export const createCompileService = ({
  rootLocation,
  cacheFolderRelativeLocation = "build",
  compiledFolderRelativeLocation = "compiled",
  compile = createCompile(),
  cacheEnabled = false,
  trackHit = false,
}) => {
  const fileService = createFileService()

  return ({ method, url, headers }) => {
    url = new URL(url, "file:///")
    headers = createHeaders(headers)

    if (method !== "GET" && method !== "HEAD") {
      return Promise.resolve({ status: 501 })
    }

    const pathname = url.pathname
    // '/compiled/folder/file.js' -> 'compiled/folder/file.js'
    const filename = pathname.slice(1)
    if (filename.startsWith(compiledFolderRelativeLocation) === false) {
      return
    }

    // je crois, que, normalement
    // il faudrait "aider" le browser pour que tout ça ait du sens
    // genre lui envoyer une redirection vers le fichier en cache
    // genre renvoyer 201 vers le cache lorsqu'il a été update ou créé
    // https://developer.mozilla.org/fr/docs/Web/HTTP/Status/201
    // renvoyer 302 ou 307 lorsque le cache existe
    // l'intérêt c'est que si jamais le browser fait une requête vers le cache
    // il sait à quoi ça correspond vraiment
    // par contre ça fait 2 requête http

    const fileLock = lockForRessource(
      getCacheDataLocation({
        rootLocation,
        cacheFolderRelativeLocation,
        compiledFolderRelativeLocation,
        filename,
      }),
    )

    if (filename.endsWith(".map")) {
      return fileLock.chain(() => {
        const script = filename.slice(0, -4) // 'folder/file.js.map' -> 'folder.file.js'

        // if we receive something like compiled/folder/file.js.map
        // we redirect to build/folder/file.js/jqjcijjojio/file.js.map

        return locateScriptCompiledFolder({
          rootLocation,
          cacheFolderRelativeLocation,
          compiledFolderRelativeLocation,
          filename: script,
          compile,
        }).then((scriptCompiledFolder) => {
          return fileService({
            method,
            url: new URL(`${scriptCompiledFolder}${path.basename(filename)}${url.search}`),
            headers,
          })
        })
      })
    }

    return fileLock.chain(() => {
      return getScriptCompiled({
        rootLocation,
        cacheFolderRelativeLocation,
        compiledFolderRelativeLocation,
        filename,
        compile,
        inputETagClient: headers.has("if-none-match") ? headers.get("if-none-match") : undefined,
        cacheEnabled,
        trackHit,
      }).then(({ status, inputETag, output }) => {
        // here status can be "created", "updated", "cached"

        // c'est un peu optimiste ici de se dire que si c'est cached et qu'on a
        // if-none-match c'est forcément le etag du client qui a match
        // faudra changer ça non?
        if (headers.has("if-none-match") && status === "cached") {
          return {
            status: 304,
            headers: {
              "cache-control": "no-store",
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
          },
          body: output,
        }
      })
    })
  }
}
