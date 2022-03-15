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

  const createReference = ({
    parentUrl,
    parentContent,
    line,
    column,
    type,
    specifier,
  }) => {
    return {
      parentUrl,
      parentContent,
      line,
      column,
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
  const specifierFromReference = (reference) => {
    // create a copy because .url will be mutated
    const referencedUrlInfo = {
      ...reference,
    }
    pluginController.callHooks(
      "transformReferencedUrl",
      reference,
      baseContext,
      (returnValue) => {
        referencedUrlInfo.url = returnValue
      },
    )
    const returnValue = pluginController.callHooksUntil(
      "formatReferencedUrl",
      referencedUrlInfo,
    )
    return returnValue || referencedUrlInfo.url
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
    }

    const getParamsForUrlTracing = async () => {
      const { url } = urlInfo
      if (reference) {
        return {
          urlTrace: {
            type: "url_string",
            value: {
              url: reference.parentUrl,
              content: reference.parentContent,
              line: reference.line,
              column: reference.column,
            },
          },
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
          parentUrl: urlInfo.url,
          parentContent: urlInfo.content,
          line: sourcemapInfo.line,
          column: sourcemapInfo.column,
          type: "js_sourcemap_comment",
          specifier: sourcemapInfo.specifier,
        })
      }
    } else if (urlInfo.contentType === "text/css") {
      const sourcemapInfo = parseCssSourcemapComment(urlInfo.content)
      if (sourcemapInfo) {
        urlInfo.sourcemap = await loadSourcemap({
          parentUrl: urlInfo.url,
          parentContent: urlInfo.content,
          line: sourcemapInfo.line,
          column: sourcemapInfo.column,
          type: "css_sourcemap_comment",
          specifier: sourcemapInfo.specifier,
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
        const { url, content, line, column } = await getPosition({
          urlInfo,
          line: error.line,
          column: error.column,
        })
        error.message = `${error.reasonCode}
${stringifyUrlSite({
  url,
  content,
  line,
  column,
})}`
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
      const references = {}
      for (const urlMention of urlMentions) {
        const urlMentionPosition = await getPosition({
          urlInfo,
          originalLine: urlMention.originalLine,
          originalColumn: urlMention.originalColumn,
          line: urlMention.line,
          column: urlMention.column,
        })
        const dependencyReference = createReference({
          parentUrl: urlMentionPosition.url,
          parentContent: urlMentionPosition.content,
          line: urlMentionPosition.line,
          column: urlMentionPosition.column,
          type: urlMention.type,
          specifier: urlMention.specifier,
        })
        try {
          resolveReference(dependencyReference)
          if (!dependencyReference.url) {
            throw new Error(`NO_RESOLVE`)
          }
        } catch (error) {
          urlInfo.error = createResolveError({
            pluginController,
            specifierTrace: {
              type: "url_site",
              value: {
                url: urlMentionPosition.url,
                content: urlMentionPosition.content,
                line: urlMentionPosition.line,
                column: urlMentionPosition.column,
              },
            },
            specifier: urlMention.specifier,
            error,
          })
          return
        }
        dependencyUrls.push(dependencyReference.url)
        references[dependencyReference.url] = dependencyReference
      }
      urlGraph.updateDependencies(urlInfo, {
        dependencyUrls,
        references,
      })
      const replacements = {}
      for (const reference of references) {
        const specifier = specifierFromReference(reference)
        const specifierFormatted =
          reference.type === "js_import_meta_url_pattern" ||
          reference.type === "js_import_export"
            ? JSON.stringify(specifier)
            : specifier
        replacements[reference.url] = specifierFormatted
      }
      const transformReturnValue = await replaceUrls(replacements)
      updateContents(transformReturnValue)
    } else {
      urlGraph.updateDependencies(urlInfo, {
        dependencyUrls: [],
        references: {},
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
      urlInfo.content = injectSourcemap(context)
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
            (prunedUrlInfo, ancestorUrlInfo) => {
              if (prunedUrlInfo.url === urlInfo.url) {
                removePrunedCallback()
                cookedReturnValue(ancestorUrlInfo)
              }
            },
          )
        }
      },
    )
  }
  const cook = async (params) => {
    try {
      const urlInfo = await _cook(params)
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

  const loadSourcemap = async ({
    parentUrl,
    parentContent,
    line,
    column,
    type,
    specifier,
  }) => {
    const sourcemapReference = createReference({
      parentUrl,
      parentContent,
      line,
      column,
      type,
      specifier,
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

const getPosition = async ({
  urlInfo,
  originalLine,
  originalColumn,
  line,
  column,
}) => {
  const adjustIfInline = ({ url, content, line, column }) => {
    const parentReference = urlInfo.data.parentReference
    if (parentReference) {
      return {
        url: parentReference.url,
        content: parentReference.content,
        // <script>console.log('ok')</script> remove 1 because code starts on same line as script tag
        line: parentReference.line + line - 1,
        column: parentReference.column + column,
      }
    }
    return {
      url,
      content,
      line,
      column,
    }
  }
  if (typeof originalLine === "number") {
    return adjustIfInline({
      url: urlInfo.url,
      content: urlInfo.originalContent,
      line: originalLine,
      column: originalColumn,
    })
  }
  if (urlInfo.content === urlInfo.originalContent) {
    return adjustIfInline({
      url: urlInfo.url,
      content: urlInfo.originalContent,
      line,
      column,
    })
  }
  // at this point things were transformed: line and column are generated
  // no sourcemap -> cannot map back to original file
  const { sourcemap } = urlInfo
  if (!sourcemap) {
    return {
      url: urlInfo.generatedUrl,
      content: urlInfo.content,
      line,
      column,
    }
  }
  const originalPosition = await getOriginalPosition({
    sourcemap,
    line,
    column,
  })
  // cannot map back to original file
  if (!originalPosition || originalPosition.line === null) {
    return {
      url: urlInfo.generatedUrl,
      content: urlInfo.content,
      line,
      column,
    }
  }
  return adjustIfInline({
    url: urlInfo.url,
    content: urlInfo.originalContent,
    line: originalPosition.line,
    column: originalPosition.column,
  })
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
