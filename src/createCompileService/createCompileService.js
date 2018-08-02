// https://github.com/jsenv/core/blob/master/src/api/util/store.js

/* eslint-disable import/max-dependencies */
import cuid from "cuid"
import path from "path"
import { URL } from "url"
import { createCompile } from "../createCompile/createCompile.js"
import { enqueueCallByArgs } from "../enqueueCall/enqueueCall.js"
import { createHeaders } from "../openServer/createHeaders.js"
import { JSON_FILE } from "./cache.js"
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
  rootLocation,
  cacheFolderRelativeLocation = "build",
  compiledFolderRelativeLocation = "compiled",
  trackHit = false,
  cacheEnabled = false,
  compile = createCompile(),
}) => ({ method, url, headers }) => {
  url = new URL(url, "file:///")
  headers = createHeaders(headers)

  const request = { method, url, headers }

  if (method !== "GET" && method !== "HEAD") {
    return Promise.resolve({ status: 501 })
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

      return Promise.resolve()
        .then(() => {
          // faudra pouvoir désactiver ce check lorsqu'on veut juste connaitre l'état du cache
          if (headers.has("if-none-match")) {
            const requestHeaderETag = headers.get("if-none-match")
            if (inputETag !== requestHeaderETag) {
              return {
                status: `eTag modified on ${inputLocation} since it was cached by client`,
                inputEtagClient: requestHeaderETag,
              }
            }
            return { status: "valid" }
          }

          const inputEtagCached = cache.inputETag
          if (inputETag !== inputEtagCached) {
            return {
              status: `eTag modified on ${inputLocation} since it was cached on filesystem`,
              inputEtagCached,
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
          status: `unexpected ${asset.name} asset for ${inputRelativeLocation}: unexpected eTag`,
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

  const readBranch = ({ inputLocation, branch, cache }) => {
    return Promise.all([
      readOutputCache({ inputLocation, branch, cache }),
      ...branch.outputAssets.map((outputAsset) =>
        readOutputAssetCache({ branch, asset: outputAsset }),
      ),
    ]).then(([mainData, ...assetsData]) => {
      const { status, input, inputEtagClient, inputEtagCached, output } = mainData

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
        inputEtagClient,
        inputEtagCached,
        output,
        outputAssets: assetsData,
      }
    })
  }

  const cacheDataLocation = getCacheDataLocation()

  // faut trouver un moyen d'apeller cette fonction de l'extérieur
  // faut aussi que cette fonction utilise enqueueCallByArgs
  // je pense que je vais simplifier l'api de enqueueCallByArgs
  // ca ressemblera plus à quelque chose à voir enqueueCall.js
  const getFileReport = (inputRelativeLocation, cacheDataLocation) => {
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
            request,
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
                data: {
                  input: content,
                },
              }
            }

            const branch = cachedBranch
            return readBranch({
              inputLocation,
              cache,
              branch,
            }).then(({ status, ...data }) => {
              return {
                status,
                inputLocation,
                cache,
                options,
                generate,
                branch,
                data,
              }
            })
          })
        })
      })
  }

  const update = ({ status, inputLocation, cache, options, branch, data }) => {
    const { branches } = cache
    const isCached = status === "valid"
    const isNew = status === "created"
    const isUpdated = status === "updated"

    if (isCached && !trackHit) {
      return Promise.resolve()
    }

    Object.assign(branch, {
      matchCount: isCached ? branch.matchCount + 1 : 1,
      createdMs: isNew ? Number(Date.now()) : branch.createdMs,
      lastModifiedMs: isCached ? branch.lastModifiedMs : Number(Date.now()),
      lastMatchMs: Number(Date.now()),
      outputMeta: options,
      outputAssets: isCached
        ? data.outputAssets.map(({ name, eTag }) => {
            return { name, eTag }
          })
        : data.outputAssets.map(({ name, content }) => {
            return { name, eTag: createETag(content) }
          }),
    })

    if (isNew) {
      branches.push(branch)
    }

    Object.assign(cache, {
      inputRelativeLocation,
      inputETag: isCached ? cache.inputETag : data.inputETag,
      branches: branches.sort(compareBranch),
    })

    if (inputLocation !== resolvePath(rootLocation, inputRelativeLocation)) {
      cache.inputLocation = inputLocation
    }

    const promises = []

    if (isNew || isUpdated) {
      promises.push(
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

    promises.push(
      writeFile({
        location: getCacheDataLocation(cache),
        string: JSON.stringify(cache, null, "\t"),
      }),
    )

    return Promise.all(promises)
  }

  const read = (cacheDataLocation) => {
    return getFileReport(inputRelativeLocation, cacheDataLocation)
      .then(({ status, inputLocation, generate, cache, branch, data }) => {
        if (cacheEnabled === false) {
          status = "missing"
        }

        if (status === "valid") {
          return {
            status: "valid",
            inputLocation,
            cache,
            branch,
            data,
          }
        }

        if (status === "missing") {
          branch = {
            name: cuid(),
          }

          return Promise.resolve(
            generate({
              outputRelativeLocation: getOutputRelativeLocation(branch),
            }),
          ).then(({ output, outputAssets }) => {
            return {
              status: "created",
              inputLocation,
              cache,
              branch,
              data: {
                ...data,
                inputETag: createETag(data.input),
                output,
                outputAssets,
              },
            }
          })
        }

        return generate({
          outputRelativeLocation: getOutputRelativeLocation(branch),
        }).then(({ output, outputAssets }) => {
          return {
            status: "updated",
            inputLocation,
            cache,
            branch,
            data: {
              ...data,
              inputETag: createETag(data.input),
              output,
              outputAssets,
            },
          }
        })
      })
      .then(({ status, inputLocation, cache, branch, data }) => {
        return update({ status, inputLocation, cache, branch, data }).then(() => {
          return data
        })
      })
      .then(({ status, output, inputETag }) => {
        // c'est un peu optimiste ici de se dire que si c'est cached et qu'on a
        // if-none-match c'est forcément le etag du client qui a match
        // faudra changer ça
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
  const enqueuedRead = enqueueCallByArgs(read)

  return enqueuedRead(cacheDataLocation)
}
