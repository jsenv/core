import { createETag, isFileNotFoundError } from "./helpers.js"
import { readFile } from "./readFile.js"
import { writeFileFromString } from "@dmail/project-structure-compile-babel"
import { getMetaLocation, getOutputLocation, getAssetLocation, getOutputName } from "./locaters.js"
import { lockForRessource } from "./ressourceRegistry.js"
import { objectMapValue } from "../objectHelper.js"

const getSourceCacheReport = ({ root, into, group, file, inputLocation, remoteEtag, eTag }) => {
  return readFile({ location: inputLocation }).then(({ content }) => {
    const inputETag = createETag(content)

    if (remoteEtag) {
      if (remoteEtag !== inputETag) {
        return { status: `remote eTag outdated` }
      }
      return { status: "valid" }
    }

    if (inputETag !== eTag) {
      return { status: `local eTag outdated` }
    }

    const outputLocation = getOutputLocation({
      root,
      into,
      group,
      file,
    })

    return readFile({
      location: outputLocation,
      errorHandler: isFileNotFoundError,
    })
      .then(({ content, error }) => {
        if (error) {
          return { status: `cache not found at ${outputLocation}` }
        }
        return { status: "valid", output: content }
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

const getAssetCacheReport = ({ root, into, group, file, asset, eTag }) => {
  const assetLocation = getAssetLocation({
    root,
    into,
    group,
    file,
    asset,
  })

  return readFile({
    location: assetLocation,
    errorHandler: isFileNotFoundError,
  }).then(({ content, error }) => {
    if (error) {
      return {
        status: `asset not found at ${assetLocation}`,
      }
    }

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
  })
}

const getFileCacheReport = ({ root, into, group, file, inputLocation, remoteETag, meta }) => {
  return Promise.all([
    getSourceCacheReport({
      root,
      into,
      group,
      file,
      inputLocation,
      eTag: meta.eTag,
      remoteETag,
    }),
    ...Object.keys(meta.assetEtagMap).map((asset) => {
      return getAssetCacheReport({
        root,
        into,
        group,
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

const getFileMeta = ({ root, into, group, file, locate }) => {
  const metaLocation = getMetaLocation({
    root,
    into,
    group,
    file,
  })

  return Promise.all([
    locate(file, root),
    readFile({
      location: metaLocation,
      errorHandler: isFileNotFoundError,
    }).then(({ content, error }) => {
      if (error) {
        // means meta file not found
        return null
      }
      const meta = JSON.parse(content)
      if (meta.file !== file) {
        throw createCacheCorruptionError(
          `${metaLocation} corrupted: file should be ${file}, got ${meta.file}`,
        )
      }
      return meta
    }),
  ])
    .then(([inputLocation, meta]) => {
      return {
        inputLocation,
        meta,
      }
    })
    .then(({ inputLocation, meta }) => {
      // here, if readFile returns ENOENT we could/should check is there is something in cache for that file
      // and take that chance to remove the cached version of that file
      // but it's not supposed to happen
      return readFile({
        location: inputLocation,
      }).then(({ content }) => {
        return {
          inputLocation,
          meta,
          input: content,
        }
      })
    })
}

const getFileReport = ({ compile, root, into, group, file, locate, remoteETag }) => {
  return getFileMeta({
    compile,
    root,
    into,
    group,
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
      root,
      into,
      group,
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
  root,
  into,
  group,
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
      root,
      into,
      group,
      file,
    })

    promises.push(
      writeFileFromString(mainLocation, output),
      ...Object.keys(assetMap).map((asset) => {
        const assetLocation = getAssetLocation({
          root,
          into,
          group,
          file,
          asset,
        })

        return writeFileFromString(assetLocation, assetMap[asset])
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
      root,
      into,
      group,
      file,
    })

    promises.push(writeFileFromString(metaLocation, JSON.stringify(meta, null, "  ")))
  }

  return Promise.all(promises)
}

export const compileFile = ({
  compile,
  root,
  into,
  group,
  groupParams,
  locate,
  cacheTrackHit,
  cacheIgnore,
  file,
  eTag,
}) => {
  const fileLock = lockForRessource(
    getMetaLocation({
      root,
      into,
      group,
      file,
    }),
  )

  return fileLock.chain(() => {
    return getFileReport({
      compile,
      root,
      into,
      group,
      file,
      locate,
      remoteETag: eTag,
    })
      .then(({ inputLocation, status, meta, input, inputETag, output, assetMap }) => {
        const outputName = getOutputName({
          into,
          group,
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

        return Promise.resolve(
          compile({ inputName: file, inputSource: output, outputName, ...groupParams }),
        ).then(({ output, assetMap = {} }) => {
          return {
            inputLocation,
            status: status === "missing" ? "created" : "updated",
            meta,
            remoteETagValid,
            input,
            inputETag: createETag(input),
            outputName,
            output,
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
            root,
            into,
            group,
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
