import { createETag, isFileNotFoundError } from "./helpers.js"
import { readFile } from "../fileHelper.js"
import { fileWriteFromString } from "@dmail/project-structure-compile-babel"
import { getMetaLocation, getOutputLocation, getAssetLocation, getOutputName } from "./locaters.js"
import { lockForRessource } from "./ressourceRegistry.js"
import { objectMapValue } from "../objectHelper.js"

const getSourceCacheReport = ({
  localRoot,
  compileInto,
  compileId,
  file,
  inputLocation,
  remoteEtag,
  eTag,
}) => {
  return readFile(inputLocation).then((input) => {
    const inputETag = createETag(input)

    if (remoteEtag) {
      if (remoteEtag !== inputETag) {
        return { status: `remote eTag outdated`, input, inputETag }
      }
      return { status: "valid", input, inputETag }
    }

    if (inputETag !== eTag) {
      return { status: `local eTag outdated`, input, inputETag }
    }

    const outputLocation = getOutputLocation({
      localRoot,
      compileInto,
      compileId,
      file,
    })

    return readFile(outputLocation).then(
      (output) => {
        return { status: "valid", input, inputETag, output }
      },
      (error) => {
        if (isFileNotFoundError(error)) {
          return { status: `cache not found at ${outputLocation}`, input, inputETag }
        }
        return Promise.reject(error)
      },
    )
  })
}

const getAssetCacheReport = ({ localRoot, compileInto, compileId, file, asset, eTag }) => {
  const assetLocation = getAssetLocation({
    localRoot,
    compileInto,
    compileId,
    file,
    asset,
  })

  return readFile(assetLocation).then(
    (content) => {
      const actual = createETag(content)
      if (actual !== eTag) {
        return {
          status: `eTag mismatch on ${asset} for file ${file}`,
          content,
        }
      }
      return {
        status: "valid",
        content,
      }
    },
    (error) => {
      if (isFileNotFoundError(error)) {
        return {
          status: `asset not found at ${assetLocation}`,
        }
      }
      return Promise.reject(error)
    },
  )
}

const getFileCacheReport = ({
  localRoot,
  compileInto,
  compileId,
  file,
  inputLocation,
  remoteETag,
  meta,
}) => {
  return Promise.all([
    getSourceCacheReport({
      localRoot,
      compileInto,
      compileId,
      file,
      inputLocation,
      eTag: meta.eTag,
      remoteETag,
    }),
    ...Object.keys(meta.assetEtagMap).map((asset) => {
      return getAssetCacheReport({
        localRoot,
        compileInto,
        compileId,
        file,
        asset,
        eTag: meta.assetEtagMap[asset],
      })
    }),
  ]).then(([sourceReport, ...assetReports]) => {
    const { status, input, inputETag, output } = sourceReport

    const assetMap = {}
    assetReports.forEach(({ content }, index) => {
      assetMap[Object.keys(meta.assetEtagMap)[index]] = content
    })

    let computedStatus
    if (status === "valid") {
      const invalidAsset = assetReports.find((assetReport) => assetReport.status !== "valid")
      computedStatus = invalidAsset ? invalidAsset.status : "valid"
    } else {
      computedStatus = status
    }

    return {
      status: computedStatus,
      input,
      inputETag,
      output,
      assetMap,
    }
  })
}

const createCacheCorruptionError = (message) => {
  const error = new Error(message)
  error.code = "CACHE_CORRUPTION_ERROR"
  return error
}

const getFileMeta = ({ localRoot, compileInto, compileId, file, locate }) => {
  const metaLocation = getMetaLocation({
    localRoot,
    compileInto,
    compileId,
    file,
  })

  return Promise.all([
    locate(file, localRoot),
    readFile(metaLocation).then(
      (content) => {
        const meta = JSON.parse(content)
        if (meta.file !== file) {
          throw createCacheCorruptionError(
            `${metaLocation} corrupted: file should be ${file}, got ${meta.file}`,
          )
        }
        return meta
      },
      (error) => {
        if (isFileNotFoundError(error)) {
          // means meta file not found
          return null
        }
        return Promise.reject(error)
      },
    ),
  ]).then(([inputLocation, meta]) => {
    // here, if readFile returns ENOENT we could/should check is there is something in cache for that file
    // and take that chance to remove the cached version of that file
    // but it's not supposed to happen
    return readFile(inputLocation).then((input) => {
      return {
        inputLocation,
        meta,
        input,
      }
    })
  })
}

const getFileReport = ({
  compile,
  localRoot,
  compileInto,
  compileId,
  file,
  locate,
  remoteETag,
}) => {
  return getFileMeta({
    compile,
    localRoot,
    compileInto,
    compileId,
    file,
    locate,
    remoteETag,
  }).then(({ inputLocation, meta, input }) => {
    if (!meta) {
      return {
        inputLocation,
        status: "missing",
        input,
      }
    }

    return getFileCacheReport({
      localRoot,
      compileInto,
      compileId,
      file,
      inputLocation,
      remoteETag,
      meta,
    }).then(({ status, input, inputETag, output, assetMap }) => {
      return {
        inputLocation,
        status,
        meta,
        input,
        inputETag,
        output,
        assetMap,
      }
    })
  })
}

const updateMeta = ({
  localRoot,
  compileInto,
  compileId,
  file,
  inputLocation,
  status,
  meta,
  inputETag,
  output,
  assetMap,
  cacheTrackHit,
}) => {
  const isCached = status === "cached"
  const isNew = status === "created"
  const isUpdated = status === "updated"

  const promises = []

  if (isNew || isUpdated) {
    const mainLocation = getOutputLocation({
      localRoot,
      compileInto,
      compileId,
      file,
    })

    promises.push(
      fileWriteFromString(mainLocation, output),
      ...Object.keys(assetMap).map((asset) => {
        const assetLocation = getAssetLocation({
          localRoot,
          compileInto,
          compileId,
          file,
          asset,
        })

        return fileWriteFromString(assetLocation, assetMap[asset])
      }),
    )
  }

  if (isNew || isUpdated || (isCached && cacheTrackHit)) {
    if (isNew) {
      meta = {
        file,
        inputLocation,
        eTag: inputETag,
        matchCount: 1,
        createdMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now()),
        lastMatchMs: Number(Date.now()),
        assetEtagMap: objectMapValue(assetMap, (value) => createETag(value)),
      }
    } else if (isUpdated) {
      meta = {
        ...meta,
        eTag: inputETag,
        inputLocation, // may change because of locate
        matchCount: meta.matchCount + 1,
        lastMatchMs: Number(Date.now()),
        lastModifiedMs: Number(Date.now()),
        assetEtagMap: objectMapValue(assetMap, (value) => createETag(value)),
      }
    } else {
      meta = {
        ...meta,
        inputLocation, // may change because of locate
        matchCount: meta.matchCount + 1,
        lastMatchMs: Number(Date.now()),
      }
    }

    const metaLocation = getMetaLocation({
      localRoot,
      compileInto,
      compileId,
      file,
    })

    promises.push(fileWriteFromString(metaLocation, JSON.stringify(meta, null, "  ")))
  }

  return Promise.all(promises)
}

export const compileFile = ({
  compile,
  localRoot,
  compileInto,
  compileId,
  compileParamMap,
  locate,
  cacheTrackHit,
  cacheIgnore,
  file,
  eTag,
}) => {
  const fileLock = lockForRessource(
    getMetaLocation({
      localRoot,
      compileInto,
      compileId,
      file,
    }),
  )

  return fileLock.chain(() => {
    return getFileReport({
      compile,
      localRoot,
      compileInto,
      compileId,
      file,
      locate,
      remoteETag: eTag,
    })
      .then(({ inputLocation, status, meta, input, inputETag, output, assetMap }) => {
        const outputName = getOutputName({
          compileInto,
          compileId,
          file,
        })

        const remoteETagValid = !cacheIgnore && eTag && status === "valid"

        if (!cacheIgnore && status === "valid") {
          return {
            inputLocation,
            status: "cached",
            meta,
            remoteETagValid,
            input,
            inputETag,
            outputName,
            output,
            assetMap,
          }
        }

        const compileParam =
          compileParamMap && compileId in compileParamMap ? compileParamMap[compileId] : {}

        return Promise.resolve(
          compile({
            localRoot,
            inputName: file,
            inputSource: input,
            outputName,
            ...compileParam,
          }),
        ).then(({ outputSource, assetMap = {} }) => {
          return {
            inputLocation,
            status: status === "missing" ? "created" : "updated",
            meta,
            remoteETagValid,
            input,
            inputETag: createETag(input),
            outputName,
            output: outputSource,
            assetMap,
          }
        })
      })
      .then(
        ({
          inputLocation,
          status,
          meta,
          remoteETagValid,
          input,
          inputETag,
          outputName,
          output,
          assetMap,
        }) => {
          return updateMeta({
            localRoot,
            compileInto,
            compileId,
            file,
            inputLocation,
            status,
            meta,
            input,
            inputETag,
            output,
            assetMap,
            cacheTrackHit,
          }).then(() => {
            return {
              eTagValid: Boolean(remoteETagValid),
              eTag: inputETag,
              output,
              outputName,
              assetMap,
            }
          })
        },
      )
  })
}
