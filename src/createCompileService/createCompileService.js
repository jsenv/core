// https://github.com/jsenv/core/blob/master/src/api/util/store.js

import { all, passed } from "@dmail/action"
import cuid from "cuid"
import path from "path"
import { JSON_FILE } from "./cache.js"
import { enqueueCallByArgs } from "./enqueueCall.js"
import { createETag, isFileNotFoundError, resolvePath } from "./helpers.js"
import { locateFile } from "./locateFile.js"
import { readFile } from "./readFile.js"
import { writeFile } from "./writeFile.js"

const compareBranch = (branchA, branchB) => {
  const lastMatchDiff = branchA.lastMatchMs - branchB.lastMatchMs

  if (lastMatchDiff === 0) {
    return branchA.matchCount - branchB.matchCount
  }
  return lastMatchDiff
}

export const createCompileService = ({
  compile,
  compileMeta = {},
  rootLocation,
  cacheFolderRelativeLocation = "build",
  trackHit = false,
  cacheEnabled = false,
}) => ({ method, url, headers }) => {
  if (method !== "GET" && method !== "HEAD") {
    return passed({ status: 501 })
  }

  const inputRelativeLocation = url.pathname.slice(1)

  // je crois, que, normalement
  // il faudrait "aider" le browser pour que tout ça ait du sens
  // genre lui envoyer une redirection vers le fichier en cache
  // genre renvoyer 201 vers le cache lorsqu'il a été update ou créé
  // https://developer.mozilla.org/fr/docs/Web/HTTP/Status/201
  // renvoyer 302 ou 307 lorsque le cache existe
  // l'intérêt c'est que si jamais le browser fait une requête vers le cache
  // il sait à quoi ça correspond vraiment
  // par contre ça fait 2 requête http

  const cacheFolderLocation = resolvePath(
    rootLocation,
    cacheFolderRelativeLocation,
    inputRelativeLocation,
  )

  const getCacheDataLocation = () => resolvePath(cacheFolderLocation, JSON_FILE)

  const getBranchRelativeLocation = (branch) => {
    return resolvePath(cacheFolderRelativeLocation, inputRelativeLocation, branch.name)
  }

  const getOutputRelativeLocation = (branch) => {
    const branchRelative = getBranchRelativeLocation(branch)
    return resolvePath(branchRelative, path.basename(inputRelativeLocation))
  }

  const getBranchLocation = (branch) => resolvePath(rootLocation, getBranchRelativeLocation(branch))

  const getOutputLocation = (branch) => resolvePath(rootLocation, getOutputRelativeLocation(branch))

  const getOutputAssetLocation = (branch, asset) =>
    resolvePath(getBranchLocation(branch), asset.name)

  const readOutputCache = ({ inputLocation, branch, cache }) => {
    return readFile({ location: inputLocation }).then(({ content }) => {
      const inputETag = createETag(content)

      return passed()
        .then(() => {
          if (headers.has("if-none-match")) {
            const requestHeaderETag = headers.get("if-none-match")
            if (inputETag !== requestHeaderETag) {
              return {
                status: `eTag modified on ${inputLocation} since it was cached by client`,
                cachedInputEtag: requestHeaderETag,
              }
            }
            return { status: "valid" }
          }

          const cachedInputEtag = cache.inputETag
          if (inputETag !== cachedInputEtag) {
            return {
              status: `eTag modified on ${inputLocation} since it was cached`,
              cachedInputEtag,
            }
          }

          const outputLocation = getOutputLocation(branch)
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

  const readBranch = ({ inputLocation, branch, cache }) => {
    return all([
      readOutputCache({ inputLocation, branch, cache }),
      ...branch.outputAssets.map((outputAsset) =>
        readOutputAssetCache({ branch, asset: outputAsset }),
      ),
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

  const getFromCacheOrGenerate = ({ inputLocation, cache }) => {
    const branchIsValid = (branch) => {
      return JSON.stringify(branch.outputMeta) === JSON.stringify(compileMeta)
    }

    const cachedBranch = cache.branches.find((branch) => branchIsValid(branch))
    if (cachedBranch) {
      const branch = cachedBranch
      return readBranch({
        inputLocation,
        cache,
        branch,
      }).then((data) => {
        if (cacheEnabled && data.status === "valid") {
          return {
            branch,
            data: {
              ...data,
              status: "cached",
            },
          }
        }
        return compile({
          input: data.input,
          inputRelativeLocation,
          outputRelativeLocation: getOutputRelativeLocation(branch),
        }).then((result) => {
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

    return readFile({ location: inputLocation }).then(({ content }) => {
      const branch = {
        name: cuid(),
      }

      return passed(
        compile({
          input: content,
          inputRelativeLocation,
          outputRelativeLocation: getOutputRelativeLocation(branch),
        }),
      ).then((result) => {
        return {
          branch,
          data: {
            status: "created",
            input: content,
            inputETag: createETag(content),
            ...result,
          },
        }
      })
    })
  }

  const update = ({ inputLocation, cache, branch, data }) => {
    const { branches } = cache
    const { status } = data
    const isCached = status === "cached"
    const isNew = status === "created"
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

    const { outputAssets = [] } = data

    Object.assign(branch, {
      matchCount: isCached ? branch.matchCount + 1 : 1,
      createdMs: isNew ? Number(Date.now()) : branch.createdMs,
      lastModifiedMs: isCached ? branch.lastModifiedMs : Number(Date.now()),
      lastMatchMs: Number(Date.now()),
      outputMeta: compileMeta,
      outputAssets: isCached
        ? branch.outputAssets
        : outputAssets.map(({ name, content }) => {
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
        ...outputAssets.map((asset) =>
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
    return locateFile(inputRelativeLocation, rootLocation)
      .then((inputLocation) => {
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
            return getFromCacheOrGenerate({ inputLocation, cache }).then(({ branch, data }) => {
              return update({ inputLocation, cache, branch, data }).then(() => {
                return data
              })
            })
          })
      })
      .then(({ status, output, inputETag }) => {
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
  }

  // all call to read will be enqueued as long as they act on the same cacheDataLocation
  const cacheDataLocation = getCacheDataLocation()
  const enqueuedRead = enqueueCallByArgs(read)
  return enqueuedRead(cacheDataLocation)
}
