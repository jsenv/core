import {
  urlIsInsideOf,
  writeFileSync,
  isFileSystemPath,
  fileSystemPathToUrl,
  moveUrl,
  fileSystemRootUrl,
} from "@jsenv/filesystem"

import { stringifyUrlSite } from "@jsenv/utils/urls/url_trace.js"
import {
  sourcemapComment,
  generateSourcemapUrl,
  sourcemapToBase64Url,
} from "@jsenv/utils/sourcemap/sourcemap_utils.js"
import { composeTwoSourcemaps } from "@jsenv/utils/sourcemap/sourcemap_composition_v3.js"

import { featuresCompatMap } from "../runtime_support/features_compatibility.js"
import { isFeatureSupportedOnRuntimes } from "../runtime_support/runtime_support.js"
import { fileUrlConverter } from "../file_url_converter.js"
import { parseUrlMentions } from "../url_mentions/parse_url_mentions.js"
import {
  createResolveError,
  createLoadError,
  createParseError,
  createTransformError,
} from "./errors.js"
import { createPluginController } from "./plugin_controller.js"

export const createKitchen = ({
  signal,
  logger,
  rootDirectoryUrl,
  urlGraph,
  plugins,
  scenario,

  sourcemaps = {
    dev: "inline", // "programmatic" and "file" also allowed
    test: "inline",
    build: "none",
  }[scenario],
  // we don't need sources in sourcemap as long as the url in the
  // sourcemap uses file:/// (chrome will understand and read from filesystem)
  sourcemapsSources = false,
  loadInlineUrlInfos = (urlInfo) => {
    return {
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    }
  },

  writeOnFileSystem = true,
}) => {
  const sourcemapsEnabled =
    sourcemaps === "inline" ||
    sourcemaps === "file" ||
    sourcemaps === "programmatic"
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
    content,
    contentType,
  }) => {
    return {
      data,
      trace,
      parentUrl,
      type,
      subtype,
      specifier,
      isInline,
      // for inline ressources the reference contains the content
      content,
      contentType,
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
      if (
        // disable on data urls (would mess up base64 encoding)
        !reference.url.startsWith("data:")
      ) {
        reference.url = reference.url.replace(/[=](?=&|$)/g, "")
      }
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
      reference.generatedSpecifier = returnValue || reference.generatedUrl
      reference.generatedSpecifier = specifierFormat.encode(reference)
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
      const loadReturnValue = urlInfo.isInline
        ? loadInlineUrlInfos(urlInfo)
        : await pluginController.callAsyncHooksUntil("load", urlInfo, context)
      if (!loadReturnValue) {
        throw new Error("NO_LOAD")
      }

      const {
        contentType = "application/octet-stream",
        content, // can be a buffer (used for binary files) or a string
        sourcemap,
        // during build urls info are reused and load returns originalContent
        // that we want to keep
        originalContent = content,
      } = loadReturnValue
      Object.assign(urlInfo, {
        contentType,
        originalContent,
        content,
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
    if (sourcemapsEnabled) {
      const sourcemapReference = getSourcemapReference(urlInfo, true)
      if (sourcemapReference) {
        try {
          const sourcemapUrlInfo = urlGraph.getUrlInfo(sourcemapReference.url)
          await context.cook({
            reference: sourcemapReference,
            urlInfo: sourcemapUrlInfo,
          })
          const sourcemap = JSON.parse(sourcemapUrlInfo.content)
          urlInfo.sourcemap = normalizeSourcemap(sourcemap, urlInfo)
          urlInfo.sourcemapUrl = sourcemapUrlInfo.url
        } catch (e) {
          logger.error(`Error while handling sourcemap: ${e.message}`)
          return
        }
      }
    }
  }

  const _cook = async ({
    reference,
    urlInfo,
    outDirectoryUrl,
    runtimeSupport,
    cookDuringCook = cook,
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
        return cookDuringCook({
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
    const addReference = (props) => {
      const reference = createReference({
        parentUrl: urlInfo.url,
        ...props,
      })
      references.push(reference)
      return [reference, resolveReference(reference)]
    }
    const referenceUtils = {
      inject: ({ trace, ...rest }) => {
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
        return addReference({
          trace,
          ...rest,
        })
      },
      foundInline: ({
        type,
        isOriginal,
        line,
        column,
        specifier,
        contentType,
        content,
      }) => {
        const parentUrl = isOriginal ? urlInfo.url : urlInfo.generatedUrl
        const parentContent = isOriginal
          ? urlInfo.originalContent
          : urlInfo.content
        const [inlineReference, inlineUrlInfo] = addReference({
          trace: stringifyUrlSite({
            url: parentUrl,
            content: parentContent,
            line,
            column,
          }),
          type,
          specifier,
          isInline: true,
          contentType,
          content,
        })
        inlineUrlInfo.isInline = true
        inlineUrlInfo.inlineUrlSite = {
          url: urlInfo.url,
          content: parentContent,
          line,
          column,
        }
        inlineUrlInfo.contentType = contentType
        inlineUrlInfo.originalContent = inlineUrlInfo.content = content
        return [inlineReference, inlineUrlInfo]
      },
      updateSpecifier: (generatedSpecifier, newSpecifier) => {
        const index = references.findIndex(
          (ref) => ref.generatedSpecifier === generatedSpecifier,
        )
        if (index === -1) {
          throw new Error(
            `Cannot find a reference for the following generatedSpecifier "${generatedSpecifier}"`,
          )
        }
        const newReference = createReference({
          ...reference,
          specifier: newSpecifier,
        })
        references[index] = newReference
        newReference.data.originalReference = reference
        return newReference
      },
      becomesInline: (
        reference,
        { isOriginal, line, column, specifier, contentType, content },
      ) => {
        const parentUrl = isOriginal ? urlInfo.url : urlInfo.generatedUrl
        const parentContent = isOriginal
          ? urlInfo.originalContent
          : urlInfo.content
        reference.trace = stringifyUrlSite({
          url: parentUrl,
          content: parentContent,
          line,
          column,
        })
        reference.isInline = true
        reference.specifier = specifier
        reference.contentType = contentType
        reference.content = content
        const urlInfo = resolveReference(reference)
        urlInfo.isInline = true
        urlInfo.inlineUrlSite = {
          url: urlInfo.url,
          content: parentContent,
          line,
          column,
        }
        urlInfo.contentType = contentType
        urlInfo.content = content
        return reference
      },
    }

    const updateContents = async (contentInfo) => {
      if (contentInfo) {
        const { contentType, content } = contentInfo
        if (contentType) {
          urlInfo.contentType = contentType
        }
        urlInfo.content = content
        if (sourcemapsEnabled && contentInfo.sourcemap) {
          urlInfo.sourcemap = normalizeSourcemap(
            await composeTwoSourcemaps(
              urlInfo.sourcemap,
              normalizeSourcemap(contentInfo.sourcemap, urlInfo),
              rootDirectoryUrl,
            ),
            urlInfo,
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
        const [reference] = addReference({
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
        await updateContents(transformReturnValue)
      }
    }

    // "transform" hook
    urlInfo.references = references
    context.referenceUtils = referenceUtils
    try {
      await pluginController.callAsyncHooks(
        "transform",
        urlInfo,
        context,
        async (transformReturnValue) => {
          await updateContents(transformReturnValue)
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

    // handle sourcemap
    if (sourcemapsEnabled && urlInfo.sourcemap) {
      // during build it's urlInfo.url to be inside the build
      // but otherwise it's generatedUrl to be inside .jsenv/ directory
      urlInfo.sourcemapGeneratedUrl = generateSourcemapUrl(urlInfo.generatedUrl)
      urlInfo.sourcemapUrl =
        urlInfo.sourcemapUrl || urlInfo.sourcemapGeneratedUrl
      if (sourcemaps === "file" || sourcemaps === "inline") {
        const sourcemapReference = createReference({
          trace: `sourcemap comment placeholder for ${urlInfo.url}`,
          type: "sourcemap_comment",
          subtype:
            urlInfo.contentType === "application/javascript" ? "js" : "css",
          parentUrl: urlInfo.url,
          specifier:
            sourcemaps === "inline"
              ? sourcemapToBase64Url(urlInfo.sourcemap)
              : urlInfo.sourcemapUrl,
        })
        const sourcemapUrlInfo = resolveReference(sourcemapReference)
        sourcemapUrlInfo.contentType = "application/json"
        sourcemapUrlInfo.type = "sourcemap"
        sourcemapUrlInfo.content = JSON.stringify(urlInfo.sourcemap, null, "  ")
        urlInfo.sourcemapUrl = sourcemapUrlInfo.url
        urlInfo.content = sourcemapComment.write({
          contentType: urlInfo.contentType,
          content: urlInfo.content,
          specifier: sourcemapReference.generatedSpecifier,
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

  const normalizeSourcemap = (sourcemap, urlInfo) => {
    const wantSourcesContent =
      // for inline content (<script> insdide html)
      // chrome won't be able to fetch the file as it does not exists
      // so sourcemap must contain sources
      urlInfo.isInline || sourcemapsSources
    if (sourcemap.sources && sourcemap.sources.length > 1) {
      sourcemap.sources = sourcemap.sources.map(
        (source) => new URL(source, urlInfo.data.sourceUrl || urlInfo.url).href,
      )
      if (!wantSourcesContent) {
        sourcemap.sourcesContent = undefined
      }
      return sourcemap
    }
    sourcemap.sources = [urlInfo.data.sourceUrl || urlInfo.url]
    sourcemap.sourcesContent = [urlInfo.originalContent]
    if (!wantSourcesContent) {
      sourcemap.sourcesContent = undefined
    }
    return sourcemap
  }

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
    url = `${rootDirectoryUrl}@fs/${url.slice(fileSystemRootUrl.length)}`
  }
  return moveUrl({
    url: fileUrlConverter.asUrlWithoutSpecialParams(url),
    from: rootDirectoryUrl,
    to: outDirectoryUrl,
    preferAbsolute: true,
  })
}

const specifierFormat = {
  encode: (reference) => {
    const { generatedSpecifier } = reference
    if (generatedSpecifier.then) {
      return generatedSpecifier.then((value) => {
        reference.generatedSpecifier = value
        return specifierFormat.encode(reference)
      })
    }
    // allow plugin to return a function to bypas default formatting
    // (which is to use JSON.stringify when url is referenced inside js)
    if (typeof generatedSpecifier === "function") {
      return generatedSpecifier()
    }
    const formatter = formatters[reference.type]
    const value = formatter
      ? formatter.encode(generatedSpecifier)
      : generatedSpecifier
    if (reference.escape) {
      return reference.escape(value)
    }
    return value
  },
  decode: (reference) => {
    const formatter = formatters[reference.type]
    return formatter
      ? formatter.decode(reference.generatedSpecifier)
      : reference.generatedSpecifier
  },
}
const formatters = {
  js_import_export: { encode: JSON.stringify, decode: JSON.parse },
  js_import_meta_url_pattern: { encode: JSON.stringify, decode: JSON.parse },
  // https://github.com/webpack-contrib/css-loader/pull/627/files
  css_url: {
    encode: (url) => {
      // If url is already wrapped in quotes, remove them
      url = formatters.css_url.decode(url)
      // Should url be wrapped?
      // See https://drafts.csswg.org/css-values-3/#urls
      if (/["'() \t\n]/.test(url)) {
        return `"${url.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`
      }
      return url
    },
    decode: (url) => {
      const firstChar = url[0]
      const lastChar = url[url.length - 1]
      if (firstChar === `"` && lastChar === `"`) {
        return url.slice(1, -1)
      }
      if (firstChar === `'` && lastChar === `'`) {
        return url.slice(1, -1)
      }
      return url
    },
  },
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
