import {
  urlIsInsideOf,
  writeFileSync,
  isFileSystemPath,
  fileSystemPathToUrl,
  moveUrl,
  ensureWindowsDriveLetter,
} from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { stringifyUrlSite } from "@jsenv/utils/urls/url_trace.js"
import { CONTENT_TYPE } from "@jsenv/utils/content_type/content_type.js"
import { normalizeUrl, setUrlFilename } from "@jsenv/utils/urls/url_utils.js"

import { createPluginController } from "../plugins/plugin_controller.js"
import { createUrlInfoTransformer } from "./url_graph/url_info_transformations.js"
import { RUNTIME_COMPAT } from "./compat/runtime_compat.js"
import { defaultRuntimeCompat } from "./compat/default_runtime_compat.js"
import {
  createResolveUrlError,
  createFetchUrlContentError,
  createTransformUrlContentError,
  createFinalizeUrlContentError,
} from "./errors.js"
import { assertFetchedContentCompliance } from "./fetched_content_compliance.js"
import { isWebWorkerEntryPointReference } from "./web_workers.js"

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
  sourcemapsSourcesContent = {
    // during dev/test, chrome is able to find the sourcemap sources
    // as long as they use file:// protocol in the sourcemap files
    dev: false,
    test: false,
    build: true,
  }[scenario],
  sourcemapsRelativeSources,
  runtimeCompat = defaultRuntimeCompat,
  writeGeneratedFiles,
}) => {
  const pluginController = createPluginController({
    plugins,
    scenario,
  })
  const jsenvDirectoryUrl = new URL(".jsenv/", rootDirectoryUrl).href
  const baseContext = {
    signal,
    logger,
    rootDirectoryUrl,
    sourcemaps,
    urlGraph,
    scenario,
    runtimeCompat,
    isSupportedOnFutureClients: (feature) => {
      return RUNTIME_COMPAT.isSupported(runtimeCompat, feature)
    },
  }
  const createReference = ({
    data = {},
    node,
    trace,
    parentUrl,
    type,
    subtype,
    expectedContentType,
    expectedType,
    expectedSubtype,
    filename,
    integrity,
    crossorigin,
    specifier,
    specifierStart,
    specifierEnd,
    specifierLine,
    specifierColumn,
    baseUrl,
    isOriginalPosition,
    external = false,
    isInline = false,
    injected = false,
    isRessourceHint = false,
    content,
    contentType,
    assert,
    assertNode,
    typePropertyNode,
  }) => {
    if (typeof specifier !== "string") {
      throw new TypeError(`"specifier" must be a string, got ${specifier}`)
    }
    return {
      original: null,
      prev: null,
      next: null,
      data,
      node,
      trace,
      parentUrl,
      type,
      subtype,
      expectedContentType,
      expectedType,
      expectedSubtype,
      filename,
      integrity,
      crossorigin,
      specifier,
      specifierStart,
      specifierEnd,
      specifierLine,
      specifierColumn,
      baseUrl,
      isOriginalPosition,
      external,
      isInline,
      injected,
      isRessourceHint,
      // for inline ressources the reference contains the content
      content,
      contentType,
      timing: {},
      assert,
      assertNode,
      typePropertyNode,
    }
  }
  const mutateReference = (reference, newReference) => {
    reference.next = newReference
    newReference.prev = reference
    newReference.original = reference.original || reference
  }
  const resolveReference = (reference) => {
    try {
      let resolvedUrl = pluginController.callHooksUntil(
        "resolveUrl",
        reference,
        baseContext,
      )
      if (!resolvedUrl) {
        throw new Error(`NO_RESOLVE`)
      }
      resolvedUrl = normalizeUrl(resolvedUrl)
      reference.url = resolvedUrl
      if (reference.external) {
        reference.generatedUrl = resolvedUrl
        reference.generatedSpecifier = reference.specifier
        return urlGraph.reuseOrCreateUrlInfo(reference.url)
      }
      pluginController.callHooks(
        "redirectUrl",
        reference,
        baseContext,
        (returnValue) => {
          const normalizedReturnValue = normalizeUrl(returnValue)
          if (normalizedReturnValue === reference.url) {
            return
          }
          const previousReference = { ...reference }
          reference.url = normalizedReturnValue
          mutateReference(previousReference, reference)
        },
      )

      const urlInfo = urlGraph.reuseOrCreateUrlInfo(reference.url)
      applyReferenceEffectsOnUrlInfo(reference, urlInfo, baseContext)

      const referenceUrlObject = new URL(reference.url)
      reference.searchParams = referenceUrlObject.searchParams
      reference.generatedUrl = reference.url
      // This hook must touch reference.generatedUrl, NOT reference.url
      // And this is because this hook inject query params used to:
      // - bypass browser cache (?v)
      // - convey information (?hmr)
      // But do not represent an other ressource, it is considered as
      // the same ressource under the hood
      pluginController.callHooks(
        "transformUrlSearchParams",
        reference,
        baseContext,
        (returnValue) => {
          Object.keys(returnValue).forEach((key) => {
            referenceUrlObject.searchParams.set(key, returnValue[key])
          })
          reference.generatedUrl = normalizeUrl(referenceUrlObject.href)
        },
      )
      const returnValue = pluginController.callHooksUntil(
        "formatUrl",
        reference,
        baseContext,
      )
      reference.generatedSpecifier = returnValue || reference.generatedUrl
      reference.generatedSpecifier = urlSpecifierFormat.encode(reference)
      return urlInfo
    } catch (error) {
      throw createResolveUrlError({
        pluginController,
        reference,
        error,
      })
    }
  }
  baseContext.resolveReference = resolveReference
  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    urlGraph,
    sourcemaps,
    sourcemapsSourcesContent,
    sourcemapsRelativeSources,
    injectSourcemapPlaceholder: ({ urlInfo, specifier }) => {
      const sourcemapReference = createReference({
        trace: `sourcemap comment placeholder for ${urlInfo.url}`,
        type: "sourcemap_comment",
        subtype: urlInfo.contentType === "text/javascript" ? "js" : "css",
        parentUrl: urlInfo.url,
        specifier,
      })
      const sourcemapUrlInfo = resolveReference(sourcemapReference)
      sourcemapUrlInfo.type = "sourcemap"
      return [sourcemapReference, sourcemapUrlInfo]
    },
    foundSourcemap: ({
      urlInfo,
      type,
      specifier,
      specifierLine,
      specifierColumn,
    }) => {
      const sourcemapReference = createReference({
        trace: stringifyUrlSite(
          adjustUrlSite(urlInfo, {
            urlGraph,
            url: urlInfo.url,
            line: specifierLine,
            column: specifierColumn,
          }),
        ),
        type,
        parentUrl: urlInfo.url,
        specifier,
        specifierLine,
        specifierColumn,
      })
      const sourcemapUrlInfo = resolveReference(sourcemapReference)
      sourcemapUrlInfo.type = "sourcemap"
      return [sourcemapReference, sourcemapUrlInfo]
    },
  })

  const fetchUrlContent = async ({ reference, urlInfo, context }) => {
    if (reference.external) {
      urlInfo.external = true
      return
    }
    try {
      const fetchUrlContentReturnValue =
        await pluginController.callAsyncHooksUntil(
          "fetchUrlContent",
          urlInfo,
          context,
        )
      if (!fetchUrlContentReturnValue) {
        logger.warn(
          createDetailedMessage(
            `no plugin has handled the url during "fetchUrlContent" hook -> consider url as external (ignore it)`,
            {
              "url": urlInfo.url,
              "url reference trace": reference.trace,
            },
          ),
        )
        urlInfo.external = true
        return
      }
      if (fetchUrlContentReturnValue.external) {
        urlInfo.external = true
        return
      }
      const {
        data,
        type,
        subtype,
        contentType = "application/octet-stream",
        originalContent,
        content,
        sourcemap,
        filename,
      } = fetchUrlContentReturnValue
      urlInfo.type =
        type ||
        reference.expectedType ||
        inferUrlInfoType({
          url: urlInfo.url,
          contentType,
        })
      urlInfo.subtype =
        subtype ||
        reference.expectedSubtype ||
        inferUrlInfoSubtype({
          url: urlInfo.url,
          type: urlInfo.type,
          subtype: urlInfo.subtype,
        })
      urlInfo.contentType = contentType
      // during build urls info are reused and load returns originalContent
      urlInfo.originalContent =
        originalContent === undefined ? content : originalContent
      urlInfo.content = content
      urlInfo.sourcemap = sourcemap
      if (data) {
        Object.assign(urlInfo.data, data)
      }
      if (filename) {
        urlInfo.filename = filename
      }
      assertFetchedContentCompliance({
        reference,
        urlInfo,
      })
    } catch (error) {
      throw createFetchUrlContentError({
        pluginController,
        urlInfo,
        reference,
        error,
      })
    }
    urlInfo.generatedUrl = determineFileUrlForOutDirectory({
      urlInfo,
      context,
    })
    await urlInfoTransformer.initTransformations(urlInfo, context)
  }

  const _cook = async ({
    reference,
    urlInfo,
    outDirectoryUrl,
    // during dev/test clientRuntimeCompat is a single runtime
    // during build clientRuntimeCompat is runtimeCompat
    clientRuntimeCompat = runtimeCompat,
    cookDuringCook = cook,
  }) => {
    baseContext.isSupportedOnCurrentClients = (feature) => {
      return RUNTIME_COMPAT.isSupported(clientRuntimeCompat, feature)
    }
    const context = {
      ...baseContext,
      reference,
      outDirectoryUrl,
      clientRuntimeCompat,
      cook: (params) => {
        return cookDuringCook({
          outDirectoryUrl,
          clientRuntimeCompat,
          ...params,
        })
      },
      fetchUrlContent: (params) => {
        return fetchUrlContent({
          context,
          ...params,
        })
      },
    }

    // "fetchUrlContent" hook
    await fetchUrlContent({ reference, urlInfo, context })
    if (urlInfo.external) {
      return
    }

    // parsing
    const references = []
    const addReference = (props) => {
      const reference = createReference({
        parentUrl: urlInfo.url,
        ...props,
      })
      references.push(reference)
      const referencedUrlInfo = resolveReference(reference)
      return [reference, referencedUrlInfo]
    }
    const referenceUtils = {
      readGeneratedSpecifier: async (reference) => {
        // "formatReferencedUrl" can be async BUT this is an exception
        // for most cases it will be sync. We want to favor the sync signature to keep things simpler
        // The only case where it needs to be async is when
        // the specifier is a `data:*` url
        // in this case we'll wait for the promise returned by
        // "formatReferencedUrl"
        if (reference.generatedSpecifier.then) {
          return reference.generatedSpecifier.then((value) => {
            reference.generatedSpecifier = value
            return value
          })
        }
        return reference.generatedSpecifier
      },
      found: ({ specifierLine, specifierColumn, ...rest }) => {
        const trace = stringifyUrlSite(
          adjustUrlSite(urlInfo, {
            urlGraph,
            url: urlInfo.url,
            line: specifierLine,
            column: specifierColumn,
          }),
        )
        // console.log(trace)
        return addReference({
          trace,
          specifierLine,
          specifierColumn,
          ...rest,
        })
      },
      foundInline: ({ isOriginalPosition, line, column, ...rest }) => {
        const parentUrl = isOriginalPosition
          ? urlInfo.url
          : urlInfo.generatedUrl
        const parentContent = isOriginalPosition
          ? urlInfo.originalContent
          : urlInfo.content
        return addReference({
          trace: stringifyUrlSite({
            url: parentUrl,
            content: parentContent,
            line,
            column,
          }),
          isOriginalPosition,
          line,
          column,
          isInline: true,
          ...rest,
        })
      },
      update: (currentReference, newReferenceParams) => {
        const index = references.indexOf(currentReference)
        if (index === -1) {
          throw new Error(`reference do not exists`)
        }
        const previousReference = currentReference
        const nextReference = createReference({
          ...previousReference,
          ...newReferenceParams,
        })
        references[index] = nextReference
        mutateReference(previousReference, nextReference)
        const newUrlInfo = resolveReference(nextReference)
        const currentUrlInfo = context.urlGraph.getUrlInfo(currentReference.url)
        if (
          currentUrlInfo &&
          currentUrlInfo !== newUrlInfo &&
          currentUrlInfo.dependents.size === 0
        ) {
          context.urlGraph.deleteUrlInfo(currentReference.url)
        }
        return [nextReference, newUrlInfo]
      },
      becomesInline: (
        reference,
        {
          isOriginalPosition,
          specifier,
          specifierLine,
          specifierColumn,
          contentType,
          content,
        },
      ) => {
        const parentUrl = isOriginalPosition
          ? urlInfo.url
          : urlInfo.generatedUrl
        const parentContent = isOriginalPosition
          ? urlInfo.originalContent
          : urlInfo.content
        return referenceUtils.update(reference, {
          trace: stringifyUrlSite({
            url: parentUrl,
            content: parentContent,
            line: specifierLine,
            column: specifierColumn,
          }),
          isOriginalPosition,
          isInline: true,
          specifier,
          specifierLine,
          specifierColumn,
          contentType,
          content,
        })
      },
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
          injected: true,
          ...rest,
        })
      },
      findByGeneratedSpecifier: (generatedSpecifier) => {
        const reference = references.find(
          (ref) => ref.generatedSpecifier === generatedSpecifier,
        )
        if (!reference) {
          throw new Error(
            `No reference found using the following generatedSpecifier: "${generatedSpecifier}"`,
          )
        }
        return reference
      },
    }

    // "transform" hook
    urlInfo.references = references
    context.referenceUtils = referenceUtils
    try {
      await pluginController.callAsyncHooks(
        "transformUrlContent",
        urlInfo,
        context,
        async (transformReturnValue) => {
          await urlInfoTransformer.applyIntermediateTransformations(
            urlInfo,
            transformReturnValue,
          )
        },
      )
    } catch (error) {
      throw createTransformUrlContentError({
        pluginController,
        reference,
        urlInfo,
        error,
      })
    }
    // after "transform" all references from originalContent
    // and the one injected by plugin are known
    urlGraph.updateReferences(urlInfo, references)

    // "finalize" hook
    try {
      const finalizeReturnValue = await pluginController.callAsyncHooksUntil(
        "finalizeUrlContent",
        urlInfo,
        context,
      )
      await urlInfoTransformer.applyFinalTransformations(
        urlInfo,
        finalizeReturnValue,
      )
    } catch (error) {
      throw createFinalizeUrlContentError({
        pluginController,
        reference,
        urlInfo,
        error,
      })
    }

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
  const cook = memoizeCook(async ({ urlInfo, outDirectoryUrl, ...rest }) => {
    outDirectoryUrl = outDirectoryUrl ? String(outDirectoryUrl) : undefined

    const writeFiles = ({ gotError }) => {
      if (!writeGeneratedFiles || !outDirectoryUrl) {
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
  })

  baseContext.cook = cook

  const prepareEntryPoint = (params) => {
    const entryReference = createReference(params)
    const entryUrlInfo = resolveReference(entryReference)
    return [entryReference, entryUrlInfo]
  }

  const injectReference = (params) => {
    const ref = createReference(params)
    const urlInfo = resolveReference(ref)
    return [ref, urlInfo]
  }

  return {
    pluginController,
    urlInfoTransformer,
    rootDirectoryUrl,
    jsenvDirectoryUrl,
    baseContext,
    cook,
    prepareEntryPoint,
    injectReference,
  }
}

const memoizeCook = (cook) => {
  const pendingDishes = new Map()
  return async (params) => {
    const { urlInfo } = params
    const { url, modifiedTimestamp } = urlInfo
    const pendingDish = pendingDishes.get(url)
    if (pendingDish) {
      if (!modifiedTimestamp) {
        await pendingDish.promise
        return
      }
      if (pendingDish.timestamp > modifiedTimestamp) {
        await pendingDish.promise
        return
      }
      pendingDishes.delete(url)
    }
    const timestamp = Date.now()
    const promise = cook(params)
    pendingDishes.set(url, {
      timestamp,
      promise,
    })
    try {
      await promise
    } finally {
      pendingDishes.delete(url)
    }
  }
}

const applyReferenceEffectsOnUrlInfo = (reference, urlInfo, context) => {
  Object.assign(urlInfo.data, reference.data)
  Object.assign(urlInfo.timing, reference.timing)
  if (reference.injected) {
    urlInfo.data.injected = true
  }
  if (reference.filename) {
    urlInfo.filename = reference.filename
  }
  if (reference.isInline) {
    urlInfo.isInline = true
    const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
    urlInfo.inlineUrlSite = {
      url: parentUrlInfo.url,
      content: reference.isOriginalPosition
        ? parentUrlInfo.originalContent
        : parentUrlInfo.content,
      line: reference.specifierLine,
      column: reference.specifierColumn,
    }
    urlInfo.contentType = reference.contentType
    urlInfo.originalContent =
      context === "build"
        ? urlInfo.originalContent === undefined
          ? reference.content
          : urlInfo.originalContent
        : reference.content
    urlInfo.content = reference.content
  }
  if (isWebWorkerEntryPointReference(reference)) {
    urlInfo.data.isWebWorkerEntryPoint = true
  }
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

const inferUrlInfoType = ({ url, contentType }) => {
  if (contentType === "text/html") {
    return "html"
  }
  if (contentType === "text/css") {
    return "css"
  }
  if (contentType === "text/javascript") {
    const urlObject = new URL(url)
    if (urlObject.searchParams.has("js_classic")) {
      return "js_classic"
    }
    return "js_module"
  }
  if (contentType === "application/importmap+json") {
    return "importmap"
  }
  if (contentType === "application/manifest+json") {
    return "webmanifest"
  }
  if (contentType === "image/svg+xml") {
    return "svg"
  }
  if (CONTENT_TYPE.isJson(contentType)) {
    return "json"
  }
  if (CONTENT_TYPE.isTextual(contentType)) {
    return "text"
  }
  return "other"
}

const inferUrlInfoSubtype = ({ type, subtype, url }) => {
  if (type === "js_classic" || type === "js_module") {
    const urlObject = new URL(url)
    if (urlObject.searchParams.has("worker")) {
      return "worker"
    }
    if (urlObject.searchParams.has("service_worker")) {
      return "service_worker"
    }
    if (urlObject.searchParams.has("shared_worker")) {
      return "shared_worker"
    }
    // if we are currently inside a worker, all deps are consider inside worker too
    return subtype
  }
  return ""
}

const determineFileUrlForOutDirectory = ({ urlInfo, context }) => {
  if (!context.outDirectoryUrl) {
    return urlInfo.url
  }
  if (!urlInfo.url.startsWith("file:")) {
    return urlInfo.url
  }
  let url = urlInfo.url
  if (!urlIsInsideOf(urlInfo.url, context.rootDirectoryUrl)) {
    const fsRootUrl = ensureWindowsDriveLetter("file:///", urlInfo.url)
    url = `${context.rootDirectoryUrl}@fs/${url.slice(fsRootUrl.length)}`
  }
  if (urlInfo.filename) {
    url = setUrlFilename(url, urlInfo.filename)
  }
  return moveUrl({
    url,
    from: context.rootDirectoryUrl,
    to: context.outDirectoryUrl,
    preferAbsolute: true,
  })
}

const urlSpecifierFormat = {
  encode: (reference) => {
    const { generatedSpecifier } = reference
    if (generatedSpecifier.then) {
      return generatedSpecifier.then((value) => {
        reference.generatedSpecifier = value
        return urlSpecifierFormat.encode(reference)
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
  "js_import_export": { encode: JSON.stringify, decode: JSON.parse },
  "js_url_specifier": { encode: JSON.stringify, decode: JSON.parse },
  "css_@import": { encode: JSON.stringify, code: JSON.stringify },
  // https://github.com/webpack-contrib/css-loader/pull/627/files
  "css_url": {
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
