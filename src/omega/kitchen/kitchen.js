import {
  urlIsInsideOf,
  writeFileSync,
  isFileSystemPath,
  fileSystemPathToUrl,
  moveUrl,
  urlToRelativeUrl,
} from "@jsenv/filesystem"

import { stringifyUrlSite } from "@jsenv/core/src/utils/url_trace.js"
import { filesystemRootUrl } from "@jsenv/core/src/utils/url_utils.js"
import { sourcemapConverter } from "@jsenv/core/src/utils/sourcemap/sourcemap_converter.js"
import {
  sourcemapComment,
  generateSourcemapUrl,
  sourcemapToBase64Url,
} from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"
import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"

import { fileUrlConverter } from "../file_url_converter.js"
import { parseUrlMentions } from "../url_mentions/parse_url_mentions.js"
import {
  createResolveError,
  createLoadError,
  createParseError,
  createTransformError,
} from "./errors.js"
import { featuresCompatMap } from "./features_compatibility.js"
import { isFeatureSupportedOnRuntimes } from "./runtime_support.js"
import { createPluginController } from "./plugin_controller.js"

export const createKitchen = ({
  signal,
  logger,
  rootDirectoryUrl,
  urlGraph,
  plugins,
  scenario,

  sourcemaps = {
    dev: "inline", // "file" is also allowed
    test: "inline",
    build: "none",
  }[scenario],
  // we don't need sources in sourcemap as long as the url in the
  // sourcemap uses file:/// (chrome will understand and read from filesystem)
  sourcemapsSources = false,

  writeOnFileSystem = true,
}) => {
  const pluginController = createPluginController({
    plugins,
    scenario,
  })
  const baseContext = {
    signal,
    logger,
    rootDirectoryUrl,
    sourcemaps,
    urlGraph,
    scenario,
  }
  const jsenvDirectoryUrl = new URL(".jsenv/", rootDirectoryUrl).href
  const normalizeSourcemap = (sourcemap) => {
    sourcemap = sourcemapConverter.toFileUrls(sourcemap)
    if (!sourcemapsSources) {
      sourcemap.sourcesContent = null
    }
    return sourcemap
  }

  const isSupported = ({
    runtimeSupport,
    featureName,
    featureCompat = featuresCompatMap[featureName],
  }) => {
    return isFeatureSupportedOnRuntimes(runtimeSupport, featureCompat)
  }

  const createReference = ({
    data = {},
    trace,
    parentUrl,
    type,
    subtype,
    specifier,
    isInline = false,
  }) => {
    return {
      data,
      trace,
      parentUrl,
      type,
      subtype,
      specifier,
      isInline,
    }
  }
  const resolveReference = (reference) => {
    try {
      const resolvedUrl = pluginController.callHooksUntil(
        "resolve",
        reference,
        baseContext,
      )
      if (!resolvedUrl) {
        throw new Error(`NO_RESOLVE`)
      }
      reference.url = resolvedUrl
      pluginController.callHooks(
        "normalize",
        reference,
        baseContext,
        (returnValue) => {
          reference.url = returnValue
        },
      )
      // force a last normalization regarding on url search params
      // some plugin use URLSearchParams to alter the url search params
      // which can result into "file:///file.css?css_module"
      // becoming "file:///file.css?css_module="
      // we want to get rid of the "=" and consider it's the same url
      reference.url = reference.url.replace(/[=](?=&|$)/g, "")
      const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url)
      Object.assign(urlInfo.data, reference.data)

      // create a copy because .url will be mutated
      const referencedCopy = {
        ...reference,
        data: urlInfo.data,
      }
      pluginController.callHooks(
        "transformReferencedUrl",
        referencedCopy,
        baseContext,
        (returnValue) => {
          referencedCopy.url = returnValue
        },
      )
      reference.generatedUrl = referencedCopy.url
      const returnValue = pluginController.callHooksUntil(
        "formatReferencedUrl",
        referencedCopy,
        baseContext,
      )
      reference.generatedSpecifier = specifierFormat.encode(
        returnValue || reference.generatedUrl,
        reference.type,
      )
      return urlInfo
    } catch (error) {
      throw createResolveError({
        pluginController,
        reference,
        error,
      })
    }
  }
  const getSourcemapReference = (urlInfo, isOriginalSourcemap) => {
    const sourcemapFound = sourcemapComment.read({
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    })
    if (!sourcemapFound) {
      return null
    }
    const { type, line, column, specifier } = sourcemapFound
    const sourcemapReference = createReference({
      trace: stringifyUrlSite(
        adjustUrlSite(urlInfo, {
          urlGraph,
          url: isOriginalSourcemap ? urlInfo.url : urlInfo.generatedUrl,
          line,
          column,
        }),
      ),
      type,
      parentUrl: urlInfo.url,
      specifier,
    })
    const sourcemapUrlInfo = resolveReference(sourcemapReference)
    sourcemapUrlInfo.type = "sourcemap"
    return sourcemapReference
  }
  const load = async ({ reference, urlInfo, context }) => {
    try {
      const loadReturnValue = await pluginController.callAsyncHooksUntil(
        "load",
        urlInfo,
        context,
      )
      if (!loadReturnValue) {
        throw new Error("NO_LOAD")
      }
      const {
        contentType = "application/octet-stream",
        content, // can be a buffer (used for binary files) or a string
        sourcemap,
      } = loadReturnValue
      Object.assign(urlInfo, {
        contentType,
        originalContent: content,
        content,
        originalSourcemap: sourcemap,
        sourcemap,
      })
      urlInfo.type = urlInfo.type || inferUrlInfoType(urlInfo)
    } catch (error) {
      throw createLoadError({
        pluginController,
        urlInfo,
        reference,
        error,
      })
    }
    urlInfo.generatedUrl = determineFileUrlForOutDirectory({
      rootDirectoryUrl,
      outDirectoryUrl: context.outDirectoryUrl,
      url: urlInfo.url,
    })
    if (urlInfo.sourcemap) {
      return
    }
    const sourcemapReference = getSourcemapReference(urlInfo, true)
    if (sourcemapReference) {
      try {
        const sourcemapUrlInfo = urlGraph.getUrlInfo(sourcemapReference.url)
        await context.cook({
          reference: sourcemapReference,
          urlInfo: sourcemapUrlInfo,
        })
        const sourcemap = normalizeSourcemap(
          JSON.parse(sourcemapUrlInfo.content),
        )
        urlInfo.sourcemapUrl = sourcemapUrlInfo.url
        urlInfo.originalSourcemap = sourcemap
        urlInfo.sourcemap = sourcemap
      } catch (e) {
        logger.error(`Error while handling sourcemap: ${e.message}`)
        return
      }
    }
  }

  const _cook = async ({
    reference,
    urlInfo,
    outDirectoryUrl,
    runtimeSupport,
  }) => {
    const context = {
      ...baseContext,
      reference,
      outDirectoryUrl,
      runtimeSupport,
      isSupportedOnRuntime: (featureName, featureCompat) => {
        return isSupported({ runtimeSupport, featureName, featureCompat })
      },
      cook: (params) => {
        return cook({
          outDirectoryUrl,
          runtimeSupport,
          ...params,
        })
      },
      load: (params) => {
        return load({
          context,
          ...params,
        })
      },
    }

    // "load" hook
    await load({ reference, urlInfo, context })

    // parsing
    const references = []
    const addReference = ({ trace, ...rest }) => {
      if (trace === undefined) {
        const { prepareStackTrace } = Error
        Error.prepareStackTrace = (error, stack) => {
          Error.prepareStackTrace = prepareStackTrace
          return stack
        }
        const { stack } = new Error()
        const callerCallsite = stack[1]
        const fileName = callerCallsite.getFileName()
        trace = stringifyUrlSite({
          url:
            fileName && isFileSystemPath(fileName)
              ? fileSystemPathToUrl(fileName)
              : fileName,
          line: callerCallsite.getLineNumber(),
          column: callerCallsite.getColumnNumber(),
        })
      }
      const reference = createReference({
        trace,
        parentUrl: urlInfo.url,
        ...rest,
      })
      references.push(reference)
      resolveReference(reference)
      return reference
    }
    const updateReference = (generatedSpecifier, referenceProps) => {
      const index = references.findIndex(
        (reference) => reference.generatedSpecifier === generatedSpecifier,
      )
      if (index === -1) {
        throw new Error(`cannot find reference using "${generatedSpecifier}"`)
      }
      const existingReference = references[index]
      const newReference = createReference({
        trace: existingReference.trace,
        parentUrl: existingReference.parentUrl,
        type: existingReference.type,
        ...referenceProps,
      })
      references[index] = newReference
      newReference.data.originalReference = existingReference
      resolveReference(newReference)
      // si l'ancienne reference n'est plus utilisé on devrait la supprimer du graph?
      return newReference
    }

    const updateContents = (data) => {
      if (data) {
        const { contentType, content, sourcemap } = data
        if (contentType) {
          urlInfo.contentType = contentType
        }
        urlInfo.content = content
        if (sourcemap) {
          urlInfo.sourcemap = composeTwoSourcemaps(
            urlInfo.sourcemap,
            sourcemap,
            rootDirectoryUrl,
          )
        }
      }
    }
    let parseResult
    try {
      parseResult = await parseUrlMentions({
        type: urlInfo.type,
        url: urlInfo.data.sourceUrl || urlInfo.url,
        generatedUrl: urlInfo.generatedUrl,
        content: urlInfo.content,
      })
    } catch (error) {
      throw createParseError({
        reference,
        urlInfo,
        error,
      })
    }
    if (parseResult) {
      const { urlMentions, replaceUrls } = parseResult
      for (const urlMention of urlMentions) {
        const reference = addReference({
          trace: stringifyUrlSite(
            adjustUrlSite(urlInfo, {
              urlGraph,
              url: urlInfo.url,
              line: urlMention.line,
              column: urlMention.column,
            }),
          ),
          type: urlMention.type,
          subtype: urlMention.subtype,
          specifier: urlMention.specifier,
        })
        urlMention.reference = reference
      }
      if (references.length) {
        // "formatReferencedUrl" can be async BUT this is an exception
        // for most cases it will be sync. We want to favor the sync signature to keep things simpler
        // The only case where it needs to be async is when
        // the specifier is a `data:*` url
        // in this case we'll wait for the promise returned by
        // "formatReferencedUrl"
        await Promise.all(
          references.map(async (reference) => {
            if (reference.generatedSpecifier.then) {
              const value = await reference.generatedSpecifier
              reference.generatedSpecifier = value
            }
          }),
        )
        const transformReturnValue = await replaceUrls((urlMention) => {
          return urlMention.reference.generatedSpecifier
        })
        updateContents(transformReturnValue)
      }
    }

    // "transform" hook
    context.addReference = addReference
    context.updateReference = updateReference
    try {
      await pluginController.callAsyncHooks(
        "transform",
        urlInfo,
        context,
        (transformReturnValue) => {
          updateContents(transformReturnValue)
        },
      )
    } catch (error) {
      throw createTransformError({
        pluginController,
        reference,
        urlInfo,
        error,
      })
    }
    // after "transform" all references from originalContent
    // and the one injected by plugin are known
    urlGraph.updateReferences(urlInfo, references)

    // append sourcemap comment
    if (urlInfo.sourcemap) {
      const sourcemap = normalizeSourcemap(urlInfo.sourcemap)
      urlInfo.sourcemap = sourcemap
      urlInfo.sourcemapUrl = generateSourcemapUrl(urlInfo.url)
      if (sourcemaps === "file" || sourcemaps === "inline") {
        const sourcemapReference = createReference({
          trace: "sourcemap comment placeholder",
          type: "sourcemap_comment",
          parentUrl: urlInfo.url,
          specifier:
            sourcemaps === "inline"
              ? sourcemapToBase64Url(sourcemap)
              : urlToRelativeUrl(urlInfo.sourcemapUrl, urlInfo.url),
        })
        const sourcemapUrlInfo = resolveReference(sourcemapReference)
        sourcemapUrlInfo.contentType = "application/json"
        sourcemapUrlInfo.type = "sourcemap"
        sourcemapUrlInfo.content = sourcemapUrlInfo.originalContent =
          JSON.stringify(sourcemap, null, "  ")
        // await context.cook({
        //   reference: sourcemapReference,
        //   urlInfo: sourcemapUrlInfo,
        // })
        urlInfo.content = sourcemapComment.write({
          contentType: urlInfo.contentType,
          content: urlInfo.content,
          specifier: await sourcemapReference.generatedSpecifier,
        })
      }
    }

    // "finalize" hook
    const finalizeReturnValue = await pluginController.callHooksUntil(
      "finalize",
      urlInfo,
      context,
    )
    updateContents(finalizeReturnValue)

    // "cooked" hook
    pluginController.callHooks(
      "cooked",
      urlInfo,
      context,
      (cookedReturnValue) => {
        if (typeof cookedReturnValue === "function") {
          const removePrunedCallback = urlGraph.prunedCallbackList.add(
            ({ prunedUrlInfos, firstUrlInfo }) => {
              const pruned = prunedUrlInfos.find(
                (prunedUrlInfo) => prunedUrlInfo.url === urlInfo.url,
              )
              if (pruned) {
                removePrunedCallback()
                cookedReturnValue(firstUrlInfo)
              }
            },
          )
        }
      },
    )
  }
  const cook = async ({ urlInfo, outDirectoryUrl, ...rest }) => {
    outDirectoryUrl = outDirectoryUrl ? String(outDirectoryUrl) : undefined

    const writeFiles = ({ gotError }) => {
      if (!writeOnFileSystem || !outDirectoryUrl) {
        return
      }
      const { generatedUrl } = urlInfo
      // writing result inside ".jsenv" directory (debug purposes)
      if (!generatedUrl || !generatedUrl.startsWith("file:")) {
        return
      }
      // use writeSync to avoid concurrency on writing the file
      const write = gotError ? writeFileSync : writeFileSync
      write(new URL(generatedUrl), urlInfo.content)
      const { sourcemapGeneratedUrl, sourcemap } = urlInfo
      if (sourcemapGeneratedUrl && sourcemap) {
        write(
          new URL(sourcemapGeneratedUrl),
          JSON.stringify(sourcemap, null, "  "),
        )
      }
    }

    try {
      await _cook({
        urlInfo,
        outDirectoryUrl,
        ...rest,
      })
      writeFiles({ gotError: false })
    } catch (e) {
      writeFiles({ gotError: true })
      throw e
    }
  }

  baseContext.cook = cook

  return {
    pluginController,
    rootDirectoryUrl,
    jsenvDirectoryUrl,
    isSupported,
    createReference,
    resolveReference,
    cook,
  }
}

const inferUrlInfoType = ({ url, contentType }) => {
  if (contentType === "text/html") {
    return "html"
  }
  if (contentType === "text/css") {
    return "css"
  }
  if (contentType === "application/javascript") {
    const urlObject = new URL(url)
    if (urlObject.searchParams.has("js_classic")) {
      return "js_classic"
    }
    if (urlObject.searchParams.has("worker_classic")) {
      return "worker_classic"
    }
    if (urlObject.searchParams.has("worker_module")) {
      return "worker_module"
    }
    if (urlObject.searchParams.has("service_worker_classic")) {
      return "service_worker_classic"
    }
    if (urlObject.searchParams.has("service_worker_module")) {
      return "service_worker_module"
    }
    return "js_module"
  }
  if (contentType === "application/json") {
    return "json"
  }
  if (contentType === "application/importmap+json") {
    return "importmap"
  }
  return "other"
}

const adjustUrlSite = (urlInfo, { urlGraph, url, line, column }) => {
  const isOriginal = url === urlInfo.url
  const adjust = (urlSite, urlInfo) => {
    if (!urlSite.isOriginal) {
      return urlSite
    }
    const inlineUrlSite = urlInfo.inlineUrlSite
    if (!inlineUrlSite) {
      return urlSite
    }
    const parentUrlInfo = urlGraph.getUrlInfo(inlineUrlSite.url)
    return adjust(
      {
        isOriginal: true,
        url: inlineUrlSite.url,
        content: inlineUrlSite.content,
        line: inlineUrlSite.line + urlSite.line,
        column: inlineUrlSite.column + urlSite.column,
      },
      parentUrlInfo,
    )
  }
  return adjust(
    {
      isOriginal,
      url,
      content: isOriginal ? urlInfo.originalContent : urlInfo.content,
      line,
      column,
    },
    urlInfo,
  )
}

const determineFileUrlForOutDirectory = ({
  rootDirectoryUrl,
  outDirectoryUrl,
  url,
}) => {
  if (!outDirectoryUrl) {
    return url
  }
  if (!url.startsWith("file:")) {
    return url
  }
  if (!urlIsInsideOf(url, rootDirectoryUrl)) {
    url = `${rootDirectoryUrl}@fs/${url.slice(filesystemRootUrl.length)}`
  }
  return moveUrl({
    url: fileUrlConverter.asUrlWithoutSpecialParams(url),
    from: rootDirectoryUrl,
    to: outDirectoryUrl,
    preferAbsolute: true,
  })
}

const specifierFormat = {
  encode: (generatedSpecifier, referenceType) => {
    if (generatedSpecifier.then) {
      return generatedSpecifier.then((value) => {
        return specifierFormat.encode(value, referenceType)
      })
    }
    // allow plugin to return a function to bypas default formatting
    // (which is to use JSON.stringify when url is referenced inside js)
    if (typeof generatedSpecifier === "function") {
      return generatedSpecifier()
    }
    const formatter = formatters[referenceType]
    return formatter ? formatter.encode(generatedSpecifier) : generatedSpecifier
  },
  decode: (generatedSpecifier, referenceType) => {
    const formatter = formatters[referenceType]
    return formatter ? formatter.decode(generatedSpecifier) : generatedSpecifier
  },
}
const formatters = {
  js_import_export: { encode: JSON.stringify, decode: JSON.parse },
  js_import_meta_url_pattern: { encode: JSON.stringify, decode: JSON.parse },
}

// import { getOriginalPosition } from "@jsenv/core/src/utils/sourcemap/original_position.js"
// const getUrlSite = async (
//   urlInfo,
//   { line, column, originalLine, originalColumn },
// ) => {
//   if (typeof originalLine === "number") {
//     return {
//       url: urlInfo.url,
//       line: originalLine,
//       column: originalColumn,
//     }
//   }
//   if (urlInfo.content === urlInfo.originalContent) {
//     return {
//       url: urlInfo.url,
//       line,
//       column,
//     }
//   }
//   // at this point things were transformed: line and column are generated
//   // no sourcemap -> cannot map back to original file
//   const { sourcemap } = urlInfo
//   if (!sourcemap) {
//     return {
//       url: urlInfo.generatedUrl,
//       content: urlInfo.content,
//       line,
//       column,
//     }
//   }
//   const originalPosition = await getOriginalPosition({
//     sourcemap,
//     line,
//     column,
//   })
//   // cannot map back to original file
//   if (!originalPosition || originalPosition.line === null) {
//     return {
//       url: urlInfo.generatedUrl,
//       line,
//       column,
//     }
//   }
//   return {
//     url: urlInfo.url,
//     line: originalPosition.line,
//     column: originalPosition.column,
//   }
// }
