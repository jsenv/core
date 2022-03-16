/*
 * TODO:
 */

import { fileURLToPath } from "node:url"
import { urlIsInsideOf, writeFile } from "@jsenv/filesystem"

import { stringifyUrlSite } from "@jsenv/core/src/utils/url_trace.js"
import { filesystemRootUrl, moveUrl } from "@jsenv/core/src/utils/url_utils.js"
import {
  parseJavaScriptSourcemapComment,
  parseCssSourcemapComment,
  generateSourcemapUrl,
} from "@jsenv/core/src/utils/sourcemap/sourcemap_utils.js"
import { composeTwoSourcemaps } from "@jsenv/core/src/utils/sourcemap/sourcemap_composition.js"
import { injectSourcemap } from "@jsenv/core/src/utils/sourcemap/sourcemap_injection.js"
import { getOriginalPosition } from "@jsenv/core/src/utils/sourcemap/original_position.js"

import { parseUrlMentions } from "../url_mentions/parse_url_mentions.js"
import {
  createResolveError,
  createLoadError,
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

  const createReference = ({ parentUrl, type, specifier, specifierTrace }) => {
    return {
      parentUrl,
      type,
      specifier,
      specifierTrace,
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
  const specifierFromReference = (reference) => {
    // create a copy because .url will be mutated
    const referencedCopy = {
      ...reference,
    }
    pluginController.callHooks(
      "transformReferencedUrl",
      reference,
      baseContext,
      (returnValue) => {
        referencedCopy.url = returnValue
      },
    )
    const returnValue = pluginController.callHooksUntil(
      "formatReferencedUrl",
      referencedCopy,
      baseContext,
    )
    return returnValue || referencedCopy.url
  }

  const _cook = async ({
    reference,
    urlInfo,
    outDirectoryName,
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
          outDirectoryName,
          runtimeSupport,
          ...params,
        })
      },
    }
    const getParamsForUrlTracing = () => {
      const { url } = urlInfo
      if (reference && reference.specifierTrace) {
        return {
          urlTrace: reference.specifierTrace,
          url,
        }
      }
      return {
        urlTrace: null,
        url,
      }
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
      urlInfo.type = getRessourceType(urlInfo)
      reference.parent = parentReference
    } catch (error) {
      urlInfo.error = createLoadError({
        pluginController,
        ...getParamsForUrlTracing(),
        error,
      })
      return
    }
    urlInfo.generatedUrl = determineFileUrlForOutDirectory({
      rootDirectoryUrl,
      outDirectoryName,
      url: urlInfo.url,
    })

    // sourcemap loading
    if (urlInfo.contentType === "application/javascript") {
      const sourcemapInfo = parseJavaScriptSourcemapComment(urlInfo.content)
      if (sourcemapInfo) {
        urlInfo.sourcemap = await loadSourcemap({
          type: "js_sourcemap_comment",
          urlInfo,
          sourcemapInfo,
        })
      }
    } else if (urlInfo.contentType === "text/css") {
      const sourcemapInfo = parseCssSourcemapComment(urlInfo.content)
      if (sourcemapInfo) {
        urlInfo.sourcemap = await loadSourcemap({
          type: "css_sourcemap_comment",
          urlInfo,
          sourcemapInfo,
        })
      }
    }

    // "transform" hook
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
      if (error.code === "PARSE_ERROR") {
        const urlSite = await getUrlSite(
          {
            line: error.line,
            column: error.column,
          },
          urlInfo,
        )

        error.message = `${error.reasonCode}
${stringifyUrlSite(urlSite)}`
      }
      urlInfo.error = createTransformError({
        pluginController,
        ...getParamsForUrlTracing(),
        type: urlInfo.type,
        error,
      })
      return
    }

    // parsing
    const parseResult = await parseUrlMentions({
      type: urlInfo.type,
      url: urlInfo.url,
      content: urlInfo.content,
    })
    if (parseResult) {
      const { urlMentions, replaceUrls } = parseResult
      const dependencyUrls = []
      const references = []
      for (const urlMention of urlMentions) {
        if (urlMention.specifier.includes("not_found.js")) {
          debugger
        }
        const referenceUrlSite = await getUrlSite(
          {
            line: urlMention.line,
            column: urlMention.column,
            originalLine: urlMention.originalLine,
            originalColumn: urlMention.originalColumn,
          },
          urlInfo,
        )
        const specifierTrace = {
          type: "url_site",
          value: referenceUrlSite,
        }
        const dependencyReference = createReference({
          parentUrl: urlInfo.url,
          type: urlMention.type,
          specifier: urlMention.specifier,
          specifierTrace,
        })
        try {
          resolveReference(dependencyReference)
          if (!dependencyReference.url) {
            throw new Error(`NO_RESOLVE`)
          }
        } catch (error) {
          urlInfo.error = createResolveError({
            pluginController,
            specifierTrace,
            specifier: urlMention.specifier,
            error,
          })
          return
        }
        dependencyUrls.push(dependencyReference.url)
        references.push(dependencyReference)
      }
      urlGraph.updateDependencies(urlInfo, {
        dependencyUrls,
        references,
      })
      const replacements = []
      references.forEach((reference, index) => {
        const specifier = specifierFromReference(reference)
        const specifierFormatted =
          reference.type === "js_import_meta_url_pattern" ||
          reference.type === "js_import_export"
            ? JSON.stringify(specifier)
            : specifier
        replacements.push({
          url: reference.url,
          urlMentionIndex: index,
          value: specifierFormatted,
        })
      })
      const transformReturnValue = await replaceUrls(replacements)
      updateContents(transformReturnValue)
    } else {
      urlGraph.updateDependencies(urlInfo, {
        dependencyUrls: [],
        references: [],
      })
    }
    await pluginController.callAsyncHooks(
      "referencesResolved",
      urlInfo,
      context,
    )

    // sourcemap injection
    const { sourcemap } = urlInfo
    if (sourcemap) {
      const sourcemapUrl = generateSourcemapUrl(urlInfo.url)
      const sourcemapGeneratedUrl = determineFileUrlForOutDirectory({
        rootDirectoryUrl,
        outDirectoryName,
        url: sourcemapUrl,
      })
      urlInfo.sourcemapGeneratedUrl = sourcemapGeneratedUrl
      urlInfo.content = injectSourcemap(urlInfo)
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
    try {
      await _cook({ urlInfo, ...rest })
      const { generatedUrl } = urlInfo
      // writing result inside ".jsenv" directory (debug purposes)
      if (generatedUrl && generatedUrl.startsWith("file:")) {
        writeFile(generatedUrl, urlInfo.content)
        const { sourcemapGeneratedUrl, sourcemap } = urlInfo
        if (sourcemapGeneratedUrl && sourcemap) {
          if (sourcemapInjection === "comment") {
            await writeFile(
              sourcemapGeneratedUrl,
              JSON.stringify(sourcemap, null, "  "),
            )
          } else if (sourcemapInjection === "inline") {
            writeFile(
              sourcemapGeneratedUrl,
              JSON.stringify(sourcemap, null, "  "),
            )
          }
        }
      }
      return urlInfo
    } catch (e) {
      throw e
    }
  }

  const loadSourcemap = async ({ type, urlInfo, sourcemapInfo }) => {
    const sourcemapReference = createReference({
      parentUrl: urlInfo.url,
      type,
      specifier: sourcemapInfo.specifier,
      specifierTrace: {
        type: "url_site",
        value: {
          url: urlInfo.url,
          content: urlInfo.content,
          line: sourcemapInfo.line,
          column: sourcemapInfo.column,
        },
      },
    })
    const sourcemapUrlInfo = resolveReference(sourcemapReference)
    await cook({
      reference: sourcemapReference,
      urlInfo: sourcemapUrlInfo,
    })
    if (sourcemapUrlInfo.error) {
      logger.error(
        `Error while handling sourcemap: ${sourcemapUrlInfo.error.message}`,
      )
      return null
    }
    const sourcemap = JSON.parse(sourcemapUrlInfo.content)
    sourcemap.sources = sourcemap.sources.map((source) => {
      return fileURLToPath(new URL(source, sourcemapUrlInfo.url).href)
    })
    return sourcemap
  }

  baseContext.createReference = createReference
  baseContext.resolveReference = resolveReference
  baseContext.specifierFromReference = specifierFromReference
  baseContext.cook = cook

  return {
    jsenvDirectoryUrl,
    isSupported,
    createReference,
    resolveReference,
    cook,
  }
}

const getRessourceType = ({ url, contentType }) => {
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

const getUrlSite = async (
  { line, column, originalLine, originalColumn },
  urlInfo,
) => {
  if (typeof originalLine === "number") {
    return adjustUrlSite(
      {
        url: urlInfo.url,
        line: originalLine,
        column: originalColumn,
      },
      urlInfo,
    )
  }
  if (urlInfo.content === urlInfo.originalContent) {
    return adjustUrlSite(
      {
        url: urlInfo.url,
        line,
        column,
      },
      urlInfo,
    )
  }
  // at this point things were transformed: line and column are generated
  // no sourcemap -> cannot map back to original file
  const { sourcemap } = urlInfo
  if (!sourcemap) {
    return adjustUrlSite(
      {
        url: urlInfo.generatedUrl,
        content: urlInfo.content,
        line,
        column,
      },
      urlInfo,
    )
  }
  const originalPosition = await getOriginalPosition({
    sourcemap,
    line,
    column,
  })
  // cannot map back to original file
  if (!originalPosition || originalPosition.line === null) {
    return adjustUrlSite(
      {
        url: urlInfo.generatedUrl,
        line,
        column,
      },
      urlInfo,
    )
  }
  return adjustUrlSite(
    {
      url: urlInfo.url,
      line: originalPosition.line,
      column: originalPosition.column,
    },
    urlInfo,
  )
}

const adjustUrlSite = ({ url, line, column }, urlInfo) => {
  const isOriginal = url === urlInfo.url
  const urlSite = {
    isOriginal,
    url,
    content: isOriginal ? urlInfo.originalContent : urlInfo.content,
    line,
    column,
  }
  if (!isOriginal) {
    return urlSite
  }
  const parentReference = urlInfo.data.parentReference
  if (!parentReference) {
    return urlSite
  }
  return {
    isOriginal: true,
    url: parentReference.url,
    content: parentReference.content,
    // <script>console.log('ok')</script> remove 1 because code starts on same line as script tag
    line: parentReference.line + line - 1,
    column: parentReference.column + column,
  }
}

// this is just for debug (ability to see what is generated)
const determineFileUrlForOutDirectory = ({
  rootDirectoryUrl,
  outDirectoryName,
  url,
}) => {
  if (!url.startsWith("file:")) {
    return url
  }
  if (!urlIsInsideOf(url, rootDirectoryUrl)) {
    url = `${rootDirectoryUrl}@fs/${url.slice(filesystemRootUrl.length)}`
  }
  const outDirectoryUrl = new URL(
    `.jsenv/${outDirectoryName}/`,
    rootDirectoryUrl,
  ).href
  return moveUrl(url, rootDirectoryUrl, outDirectoryUrl)
}
