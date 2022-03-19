import { fileURLToPath } from "node:url"
import { writeFileSync } from "node:fs"
import {
  urlIsInsideOf,
  writeFile,
  isFileSystemPath,
  fileSystemPathToUrl,
} from "@jsenv/filesystem"

import { stringifyUrlSite } from "@jsenv/core/src/utils/url_trace.js"
import { filesystemRootUrl, moveUrl } from "@jsenv/core/src/utils/url_utils.js"
import {
  parseJavaScriptSourcemapComment,
  parseCssSourcemapComment,
  generateSourcemapUrl,
} from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"
import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"
import { injectSourcemap } from "@jsenv/core/src/utils/sourcemap/sourcemap_injection.js"

import { parseUrlMentions } from "../url_mentions/parse_url_mentions.js"
import {
  createResolveError,
  createLoadError,
  createParseError,
  createTransformError,
} from "./errors.js"
import { featuresCompatMap } from "./features_compatibility.js"
import { isFeatureSupportedOnRuntimes } from "./runtime_support.js"

export const createKitchen = ({
  signal,
  logger,
  rootDirectoryUrl,
  pluginController,
  sourcemapInjection,
  urlGraph,
  scenario,

  baseUrl = "/",
  writeOnFileSystem = true,
}) => {
  const baseContext = {
    signal,
    logger,
    rootDirectoryUrl,
    sourcemapInjection,
    urlGraph,
    scenario,
    baseUrl,
  }
  const jsenvDirectoryUrl = new URL(".jsenv/", rootDirectoryUrl).href

  const isSupported = ({
    runtimeSupport,
    featureName,
    featureCompat = featuresCompatMap[featureName],
  }) => {
    return isFeatureSupportedOnRuntimes(runtimeSupport, featureCompat)
  }

  const createReference = ({ trace, parentUrl, type, specifier }) => {
    return {
      trace,
      parentUrl,
      type,
      specifier,
      data: {},
    }
  }
  const resolveReference = (reference) => {
    const resolvedUrl = pluginController.callHooksUntil(
      "resolve",
      reference,
      baseContext,
    )
    if (!resolvedUrl) {
      return null
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
    const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url)
    Object.assign(urlInfo.data, reference.data)
    return urlInfo
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
    }

    // "load" hook
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
        parentReference,
      } = loadReturnValue
      Object.assign(urlInfo, {
        contentType,
        originalContent: content,
        content,
      })
      urlInfo.type = urlInfo.type || inferUrlInfoType(urlInfo)
      reference.parent = parentReference
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
      outDirectoryUrl,
      url: urlInfo.url,
    })

    // sourcemap loading
    let sourcemapReferenceInfo
    if (urlInfo.contentType === "application/javascript") {
      sourcemapReferenceInfo = parseJavaScriptSourcemapComment(urlInfo.content)
    } else if (urlInfo.contentType === "text/css") {
      sourcemapReferenceInfo = parseCssSourcemapComment(urlInfo.content)
    }
    if (sourcemapReferenceInfo) {
      const { type, line, column, specifier } = sourcemapReferenceInfo
      const sourcemapReference = createReference({
        trace: stringifyUrlSite(
          adjustUrlSite(urlInfo, {
            urlGraph,
            url: urlInfo.url,
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
      try {
        await context.cook({
          reference: sourcemapReference,
          urlInfo: sourcemapUrlInfo,
        })
        const sourcemap = JSON.parse(sourcemapUrlInfo.content)
        sourcemap.sources = sourcemap.sources.map((source) => {
          return fileURLToPath(new URL(source, sourcemapUrlInfo.url).href)
        })
        context.sourcemap = sourcemap
      } catch (e) {
        logger.error(`Error while handling sourcemap: ${e.message}`)
      }
    }

    // parsing
    const references = []
    const addReference = ({ trace, type, specifier }) => {
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
        type,
        specifier,
      })
      references.push(reference)
      try {
        resolveReference(reference)
        if (!reference.url) {
          throw new Error(`NO_RESOLVE`)
        }
      } catch (error) {
        throw createResolveError({
          pluginController,
          reference,
          error,
        })
      }

      // create a copy because .url will be mutated
      const referencedCopy = {
        ...reference,
        data: urlGraph.getUrlInfo(reference.url).data,
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
      // TODO: || faire JSOn.stringify
      reference.generatedSpecifier = returnValue || reference.generatedUrl
      return reference
    }
    const updateContents = (data) => {
      if (data) {
        const { contentType, content, sourcemap } = data
        if (contentType) {
          urlInfo.contentType = contentType
        }
        urlInfo.content = content
        if (sourcemap) {
          urlInfo.sourcemap = composeTwoSourcemaps(urlInfo.sourcemap, sourcemap)
        }
      }
    }
    let parseResult
    try {
      parseResult = await parseUrlMentions({
        type: urlInfo.type,
        url: urlInfo.generatedUrl,
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

    // sourcemap injection
    const { sourcemap } = urlInfo
    if (sourcemap) {
      const sourcemapUrl = generateSourcemapUrl(urlInfo.url)
      const sourcemapGeneratedUrl = determineFileUrlForOutDirectory({
        rootDirectoryUrl,
        outDirectoryUrl,
        url: sourcemapUrl,
      })
      urlInfo.sourcemapGeneratedUrl = sourcemapGeneratedUrl
      urlInfo.content = injectSourcemap(urlInfo, { sourcemapInjection })
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
  const cook = async ({ urlInfo, ...rest }) => {
    const writeFiles = ({ gotError }) => {
      if (!writeOnFileSystem) {
        return
      }
      const { generatedUrl } = urlInfo
      // writing result inside ".jsenv" directory (debug purposes)
      if (!generatedUrl || !generatedUrl.startsWith("file:")) {
        return
      }
      const write = gotError ? writeFileSync : writeFile
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
      await _cook({ urlInfo, ...rest })
      writeFiles({ gotError: false })
    } catch (e) {
      writeFiles({ gotError: true })
      throw e
    }
  }

  baseContext.cook = cook

  return {
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
    const inlineInfo = urlInfo.inlineInfo
    if (!inlineInfo) {
      return urlSite
    }
    const inlineUrlSite = inlineInfo.urlSite
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

// this is just for debug (ability to see what is generated)
const determineFileUrlForOutDirectory = ({
  rootDirectoryUrl,
  outDirectoryUrl,
  url,
}) => {
  if (!url.startsWith("file:")) {
    return url
  }
  if (!urlIsInsideOf(url, rootDirectoryUrl)) {
    url = `${rootDirectoryUrl}@fs/${url.slice(filesystemRootUrl.length)}`
  }
  return moveUrl(url, rootDirectoryUrl, outDirectoryUrl)
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
