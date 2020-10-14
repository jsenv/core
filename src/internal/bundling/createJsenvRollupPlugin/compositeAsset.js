/**

--- Inlining asset ---
In the context of http2 and beyond http request
is reused so saving http request by inlining asset is less
attractive.
You gain some speed because one big file is still faster
than many small files.

But inlined asset got two drawbacks:

(1) they cannot be cached by the browser
assets inlined in the html file have no hash
and must be redownloaded every time.
-> No way to mitigate this

(2) they cannot be shared by different files.
assets inlined in the html cannot be shared
because their source lives in the html.
You might accidentatly load twice a css because it's
referenced both in js and html for instance.
-> We could warn about asset inlined + referenced
more than once

*/

import {
  resolveUrl,
  urlToRelativeUrl,
  urlIsInsideOf,
  isFileSystemPath,
  fileSystemPathToUrl,
  urlToParentUrl,
} from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
import { computeFileNameForRollup } from "./computeFileNameForRollup.js"
import { showSourceLocation } from "./showSourceLocation.js"
import { inlineReference } from "./inlineReference.js"

const logger = createLogger({ logLevel: "debug" })

const assetFileNamePattern = "assets/[name]-[hash][extname]"

const computeTargetFileNameForRollup = (target) => {
  return computeFileNameForRollup(
    target.url,
    target.sourceAfterTransformation,
    target.fileNamePattern || assetFileNamePattern,
  )
}

const precomputeTargetFileNameForRollup = (target, sourceAfterTransformation = "") => {
  if (target.fileNameForRollup) {
    return target.fileNameForRollup
  }

  target.sourceAfterTransformation = sourceAfterTransformation
  const precomputedFileNameForRollup = computeTargetFileNameForRollup(target)
  target.sourceAfterTransformation = undefined
  return precomputedFileNameForRollup
}

export const createCompositeAssetHandler = (
  { load, parse },
  {
    projectDirectoryUrl = "file:///",
    bundleDirectoryUrl = "file:///",
    loadUrl = () => null,
    urlToOriginalProjectUrl = (url) => url,
    emitAsset,
    connectTarget = () => {},
    resolveReference = ({ specifier }, target) => resolveUrl(specifier, target.url),
    inlineAssetPredicate,
  },
) => {
  const prepareAssetEntry = async (url, { fileNamePattern, source }) => {
    logger.debug(`prepare entry asset ${shortenUrl(url)}`)

    // we don't really know where this reference to that asset file comes from
    // we could almost say it's from the script calling this function
    // so we could analyse stack trace here to put this function caller
    // as the reference to this target file
    const callerLocation = getCallerLocation()
    const entryReference = createReference(callerLocation, {
      isEntry: true,
      isAsset: true,
      url,
      fileNamePattern,
      source,
    })

    await entryReference.target.getReferencesReadyPromise()
    // start to wait internally for eventual chunks
    // but don't await here because this function will be awaited by rollup before starting
    // to parse chunks
    entryReference.getReadyPromise()
  }

  const targetMap = {}
  const createReference = (referenceData, targetData) => {
    const { url } = targetData
    const reference = { ...referenceData }

    if (url in targetMap) {
      const target = targetMap[url]
      connectReferenceAndTarget(reference, target)
      return [reference, target]
    }

    const target = createTarget(targetData)
    targetMap[url] = target
    connectReferenceAndTarget(reference, target)
    connectTarget(target)
    return reference
  }

  const connectReferenceAndTarget = (reference, target) => {
    reference.target = target
    target.importers.push(reference)

    reference.getReadyPromise = memoize(async () => {
      // logger.debug(`${shortenUrl(reference.url)} waiting for ${shortenUrl(target.url)} to be ready`)
      await target.getFileNameReadyPromise()

      const otherImporters = target.importers.filter((ref) => ref !== reference)
      const assetProjectRelativeUrl = target.relativeUrl
      const assetSize = Buffer.byteLength(target.sourceAfterTransformation)
      const hasMultipleImporters = Boolean(otherImporters.length)

      const preferInline = inlineAssetPredicate({
        assetProjectRelativeUrl,
        assetSize,
        hasMultipleImporters,
      })
      reference.preferInline = preferInline

      // we gave information to inlineAssetPredicate that there is multiple importers
      // but inlineAssetPredicate still decides to return true
      // so let's assume it's desired a put log level to debug
      if (preferInline && hasMultipleImporters) {
        logger.debug(formatAssetDuplicationDebug(reference, otherImporters[0]))
      }

      // we just found a reference to something that was inline before
      // but at that time we certainly was not aware there was an other importer
      // for this asset. So asset will end up duplicated (once inlined, one referenced by url)
      // -> emit a warning about that.
      if (!preferInline) {
        const otherInlineImporterReference = otherImporters.find(
          (otherImporter) => otherImporter.preferInline === true,
        )
        if (otherInlineImporterReference) {
          logger.warn(formatAssetDuplicationWarning(reference, otherInlineImporterReference))
        }
      }
    })
  }

  const assetTransformMap = {}
  const createTarget = ({
    url,
    isEntry = false,
    isAsset = false,
    isInline = false,
    source,
    sourceAfterTransformation,
    fileNamePattern,
    importers = [],
  }) => {
    const target = {
      url,
      relativeUrl: urlToRelativeUrl(url, projectDirectoryUrl),
      isEntry,
      isAsset,
      isInline,
      source,
      sourceAfterTransformation,
      fileNamePattern,
      importers,
    }

    const getSourceReadyPromise = memoize(async () => {
      const source = await load(url, importers[0].url)
      target.source = source
    })
    if (source !== undefined) {
      getSourceReadyPromise.forceMemoization(source)
    }

    const getReferencesReadyPromise = memoize(async () => {
      await getSourceReadyPromise()
      const references = []

      let previousJsReference

      const notifyReferenceFound = ({
        isAsset,
        isInline,
        specifier,
        line,
        column,
        source,
        fileNamePattern,
      }) => {
        if (!isEntry && !isAsset) {
          // for now we can only emit a chunk from an entry file as visible in
          // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
          // https://github.com/rollup/rollup/issues/2872
          logger.warn(
            `ignoring js reference found in an asset (it's only possible to reference js from entry asset)`,
          )
          return null
        }

        const childTargetUrl = resolveReference({ specifier, isAsset, isInline }, target)
        const childReference = createReference(
          { url: target.url, column, line, previousJsReference },
          { url: childTargetUrl, isAsset, isInline, source, fileNamePattern },
        )
        if (childReference.target.isConnected()) {
          references.push(childReference)
          if (!isAsset) {
            previousJsReference = childReference
          }
        }
        logger.debug(formatReferenceFound(childReference))
        return childReference
      }

      const parseReturnValue = await parse(target, {
        notifyAssetFound: (data) =>
          notifyReferenceFound({
            isAsset: true,
            isInline: false,
            ...data,
          }),
        notifyInlineAssetFound: (data) =>
          notifyReferenceFound({
            isAsset: true,
            isInline: true,
            // inherit parent directory location because it's an inline asset
            fileNamePattern: () => {
              const importerFileNameForRollup = precomputeTargetFileNameForRollup(target)
              const importerParentRelativeUrl = urlToRelativeUrl(
                urlToParentUrl(resolveUrl(importerFileNameForRollup, "file://")),
                "file://",
              )
              return `${importerParentRelativeUrl}[name]-[hash][extname]`
            },
            ...data,
          }),
        notifyJsFound: (data) =>
          notifyReferenceFound({
            isAsset: false,
            isInline: false,
            ...data,
          }),
        notifyInlineJsFound: (data) =>
          notifyReferenceFound({
            isAsset: false,
            isInline: true,
            ...data,
          }),
      })

      if (references.length > 0 && typeof parseReturnValue !== "function") {
        throw new Error(
          `parse has references, it must return a function but received ${parseReturnValue}`,
        )
      }
      if (typeof parseReturnValue === "function") {
        assetTransformMap[url] = parseReturnValue
      }
      if (references.length) {
        logger.debug(
          `${shortenUrl(url)} references collected -> ${references.map((reference) =>
            shortenUrl(reference.target.url),
          )}`,
        )
      }

      target.references = references
    })

    const getFileNameReadyPromise = memoize(async () => {
      // une fois que les dépendances sont transformées on peut transformer cet asset
      if (!target.isAsset) {
        // ici l'url n'est pas top parce que
        // l'url de l'asset est relative au fichier html source
        logger.debug(`waiting for rollup chunk to be ready to resolve ${shortenUrl(url)}`)
        const rollupChunkReadyPromise = new Promise((resolve) => {
          registerCallbackOnceRollupChunkIsReady(target.url, resolve)
        })
        const { sourceAfterTransformation, fileNameForRollup } = await rollupChunkReadyPromise
        target.sourceAfterTransformation = sourceAfterTransformation
        target.fileNameForRollup = fileNameForRollup
        return
      }

      // la transformation d'un asset c'est avant tout la transformation de ses dépendances
      await getReferencesReadyPromise()
      const references = target.references
      await Promise.all(references.map((reference) => reference.getReadyPromise()))

      if (!assetTransformMap.hasOwnProperty(url)) {
        target.sourceAfterTransformation = target.source
        target.fileNameForRollup = computeTargetFileNameForRollup(target)
        return
      }

      const transform = assetTransformMap[url]
      // assetDependenciesMapping contains all dependencies for an asset
      // each key is the absolute url to the dependency file
      // each value is an url relative to the asset importing this dependency
      // it looks like this:
      // {
      //   "file:///project/coin.png": "./coin-45eiopri.png"
      // }
      // we don't yet know the exact importerFileNameForRollup but we can generate a fake one
      // to ensure we resolve dependency against where the importer file will be

      const importerFileNameForRollup = precomputeTargetFileNameForRollup(target)
      const assetEmitters = []
      const transformReturnValue = await transform({
        precomputeFileNameForRollup: (sourceAfterTransformation) =>
          precomputeTargetFileNameForRollup(target, sourceAfterTransformation),
        registerAssetEmitter: (callback) => {
          assetEmitters.push(callback)
        },
        getReferenceUrlRelativeToImporter: (reference) => {
          const referenceTarget = reference.target
          const referenceFileNameForRollup = referenceTarget.fileNameForRollup
          const referenceUrlForRollup = resolveUrl(referenceFileNameForRollup, "file:///")
          const importerFileUrlForRollup = resolveUrl(importerFileNameForRollup, "file:///")
          return urlToRelativeUrl(referenceUrlForRollup, importerFileUrlForRollup)
        },
      })
      if (transformReturnValue === null || transformReturnValue === undefined) {
        throw new Error(`transform must return an object {code, map}`)
      }

      let sourceAfterTransformation
      let fileNameForRollup
      if (typeof transformReturnValue === "string") {
        sourceAfterTransformation = transformReturnValue
      } else {
        sourceAfterTransformation = transformReturnValue.sourceAfterTransformation
        if (transformReturnValue.fileNameForRollup) {
          fileNameForRollup = transformReturnValue.fileNameForRollup
        }
      }

      target.sourceAfterTransformation = sourceAfterTransformation
      if (fileNameForRollup === undefined) {
        fileNameForRollup = computeTargetFileNameForRollup(target)
      }
      target.fileNameForRollup = fileNameForRollup

      assetEmitters.forEach((callback) => {
        const importerProjectUrl = target.url
        const importerBundleUrl = resolveUrl(fileNameForRollup, bundleDirectoryUrl)
        const { assetSource, assetUrl } = callback({
          importerProjectUrl,
          importerBundleUrl,
        })

        emitAsset({
          source: assetSource,
          fileName: urlToRelativeUrl(assetUrl, bundleDirectoryUrl),
        })
        logger.debug(`emit ${fileNameForRollup} asset emitted by ${fileNameForRollup}`)
      })
    })

    let connected = false
    const connect = memoize(async (connectFn) => {
      connected = true
      const { rollupReferenceId } = await connectFn()
      target.rollupReferenceId = rollupReferenceId
    })

    // the idea is to return the connect promise here
    // because connect is memoized and called immediatly after target is created
    const getRollupReferenceIdReadyPromise = () => connect()

    Object.assign(target, {
      connect,
      isConnected: () => connected,
      createReference,

      getSourceReadyPromise,
      getReferencesReadyPromise,
      getFileNameReadyPromise,
      getRollupReferenceIdReadyPromise,
    })

    return target
  }

  const rollupChunkReadyCallbackMap = {}
  const registerCallbackOnceRollupChunkIsReady = (url, callback) => {
    rollupChunkReadyCallbackMap[url] = callback
  }

  const resolveJsReferencesUsingRollupBundle = async (rollupBundle) => {
    Object.keys(rollupChunkReadyCallbackMap).forEach((key) => {
      const chunkName = Object.keys(rollupBundle).find(
        (bundleKey) => rollupBundle[bundleKey].facadeModuleId === key,
      )
      const chunk = rollupBundle[chunkName]
      logger.debug(`resolve rollup chunk ${shortenUrl(key)}`)
      rollupChunkReadyCallbackMap[key]({
        sourceAfterTransformation: chunk.code,
        fileNameForRollup: chunk.fileName,
      })
    })

    // wait html files to be emitted
    const urlToWait = Object.keys(targetMap).filter((url) => targetMap[url].isEntry)
    await Promise.all(urlToWait.map((url) => targetMap[url].getRollupReferenceIdReadyPromise()))
  }

  const removeInlinedAssetsFromRollupBundle = (rollupBundle) => {
    Object.keys(rollupBundle).forEach((key) => {
      const file = rollupBundle[key]
      if (file.type === "asset") {
        const { fileName } = file
        const targetUrl = Object.keys(targetMap).find(
          (key) => targetMap[key].fileNameForRollup === fileName,
        )
        if (targetUrl) {
          const target = targetMap[targetUrl]
          const allImportersInlined = target.importers.every(
            (importerReference) => importerReference.preferInline,
          )
          if (allImportersInlined) {
            delete rollupBundle[key]
          }
        }
      }
    })
  }

  const generateJavaScriptForAssetImport = async (url, { source, importerUrl } = {}) => {
    const assetReference = createReference(
      // the reference to this target comes from importerUrl
      // but we don't really know the line and column
      // because rollup does not share this information
      {
        url: importerUrl,
        column: undefined,
        line: undefined,
      },
      {
        url,
        isAsset: true,
        source,
      },
    )

    logger.debug(formatReferenceFound(assetReference))

    if (!assetReference.target.isConnected()) {
      throw new Error(`target is not connected ${url}`)
    }
    await assetReference.target.getRollupReferenceIdReadyPromise()
    const { preferInline } = assetReference
    if (preferInline) {
      return `export default ${inlineReference(assetReference)}`
    }
    const { rollupReferenceId } = assetReference.target
    return `export default import.meta.ROLLUP_FILE_URL_${rollupReferenceId};`
  }

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : url
  }

  const showReferenceSourceLocation = (reference) => {
    const referenceUrl = reference.url
    const referenceSource = String(
      referenceUrl in targetMap ? targetMap[referenceUrl].source : loadUrl(referenceUrl),
    )

    const message = `${urlToOriginalProjectUrl(referenceUrl)}:${reference.line}:${reference.column}`

    if (referenceSource) {
      return `${message}

${showSourceLocation(referenceSource, {
  line: reference.line,
  column: reference.column,
})}`
    }

    return `${message}`
  }

  const formatReferenceFound = (reference) => {
    const { target } = reference
    const targetUrl = shortenUrl(target.url)

    let message
    if (target.isInline && target.isAsset) {
      message = `found inline asset.`
    } else if (target.isInline) {
      message = `found inline js.`
    } else if (target.isAsset) {
      message = `found asset reference to ${targetUrl}.`
    } else {
      message = `found js reference to ${targetUrl}.`
    }

    message += `
${showReferenceSourceLocation(reference)}
`

    if (reference.target.isConnected()) {
      return message
    }
    return `${message} -> ignored because url is external`
  }

  const formatAssetDuplicationDebug = (reference, otherReference) => {
    return `${
      reference.target.relativeUrl
    } asset will be duplicated because it wants to be inlined and is referenced elsewhere.
--- reference prefering inline ---
${showReferenceSourceLocation(reference)}
--- other reference ---
${showReferenceSourceLocation(otherReference)}`
  }

  const formatAssetDuplicationWarning = (reference, otherReference) => {
    return `${
      reference.target.relativeUrl
    } asset will be duplicated because it was inlined and is now referenced.
--- previous inline reference ---
${showReferenceSourceLocation(reference)}
--- reference ---
${showReferenceSourceLocation(otherReference)}`
  }

  return {
    prepareAssetEntry,
    resolveJsReferencesUsingRollupBundle,
    generateJavaScriptForAssetImport,
    removeInlinedAssetsFromRollupBundle,

    showReferenceSourceLocation,
    inspect: () => {
      return {
        targetMap,
      }
    },
  }
}

const memoize = (fn) => {
  let called
  let previousCallReturnValue
  const memoized = (...args) => {
    if (called) return previousCallReturnValue
    previousCallReturnValue = fn(...args)
    called = true
    return previousCallReturnValue
  }
  memoized.forceMemoization = (value) => {
    called = true
    previousCallReturnValue = value
  }
  return memoized
}

const getCallerLocation = () => {
  const { prepareStackTrace } = Error
  Error.prepareStackTrace = (error, stack) => {
    Error.prepareStackTrace = prepareStackTrace
    return stack
  }

  const { stack } = new Error()
  const callerCallsite = stack[2]
  const fileName = callerCallsite.getFileName()
  return {
    url: fileName && isFileSystemPath(fileName) ? fileSystemPathToUrl(fileName) : fileName,
    line: callerCallsite.getLineNumber(),
    column: callerCallsite.getColumnNumber(),
  }
}
