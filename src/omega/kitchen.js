import {
  urlIsInsideOf,
  writeFileSync,
  isFileSystemPath,
  fileSystemPathToUrl,
  moveUrl,
  fileSystemRootUrl,
} from "@jsenv/filesystem"
import { createDetailedMessage } from "@jsenv/logger"

import { stringifyUrlSite } from "@jsenv/utils/urls/url_trace.js"
import { setUrlExtension } from "@jsenv/utils/urls/url_utils.js"

import { createUrlInfoTransformer } from "./url_graph/url_info_transformations.js"
import { jsenvPluginUrlReferences } from "./core_plugins/url_references/jsenv_plugin_url_references.js"
import { RUNTIME_COMPAT } from "./compat/runtime_compat.js"
import { defaultRuntimeCompat } from "./compat/default_runtime_compat.js"
import {
  createResolveError,
  createLoadError,
  createTransformError,
  createFinalizeError,
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
  runtimeCompat = defaultRuntimeCompat,

  loadInlineUrlInfos = (urlInfo) => {
    return {
      contentType: urlInfo.contentType,
      content: urlInfo.content,
    }
  },
  writeOnFileSystem = true,
}) => {
  const pluginController = createPluginController({
    plugins: [jsenvPluginUrlReferences(), ...plugins],
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
    trace,
    parentUrl,
    type,
    subtype,
    expectedType,
    expectedSubtype,
    specifier,
    baseUrl,
    isInline = false,
    injected = false,
    content,
    contentType,
  }) => {
    return {
      data,
      trace,
      parentUrl,
      type,
      subtype,
      expectedType,
      expectedSubtype,
      specifier,
      baseUrl,
      isInline,
      injected,
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
      if (reference.injected) urlInfo.data.injected = true

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
  const urlInfoTransformer = createUrlInfoTransformer({
    logger,
    urlGraph,
    sourcemaps,
    sourcemapsSources,
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
    foundSourcemap: ({ urlInfo, line, column, type, specifier }) => {
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
      return [sourcemapReference, sourcemapUrlInfo]
    },
  })

  const load = async ({ reference, urlInfo, context }) => {
    try {
      const loadReturnValue = urlInfo.isInline
        ? loadInlineUrlInfos(urlInfo)
        : await pluginController.callAsyncHooksUntil("load", urlInfo, context)
      if (!loadReturnValue) {
        logger.warn(
          createDetailedMessage(
            `no plugin has handled the url during "load" hook -> consider url as external (ignore it)`,
            {
              "url": urlInfo.url,
              "url reference trace": reference.trace,
            },
          ),
        )
        urlInfo.external = true
        return
      }
      if (loadReturnValue.external) {
        urlInfo.external = true
        return
      }
      const {
        contentType = "application/octet-stream",
        content, // can be a buffer (used for binary files) or a string
        sourcemap,
        // during build urls info are reused and load returns originalContent
        // that we want to keep
        originalContent = content,
        data,
      } = loadReturnValue
      Object.assign(urlInfo, {
        contentType,
        originalContent,
        content,
        sourcemap,
      })
      if (data) {
        Object.assign(urlInfo.data, data)
      }
      if (!urlInfo.type) {
        const type = inferUrlInfoType(urlInfo)
        if (type === "js") {
          const urlObject = new URL(urlInfo.url)
          if (urlObject.searchParams.has("worker_type_classic")) {
            urlInfo.type = "js_classic"
            urlInfo.subtype = "worker"
          } else if (
            urlObject.searchParams.has("service_worker_type_classic")
          ) {
            urlInfo.type = "js_classic"
            urlInfo.subtype = "service_worker"
          } else if (urlObject.searchParams.has("js_classic")) {
            urlInfo.type = "js_classic"
          } else {
            urlInfo.type = "js_module"
          }
          if (urlObject.searchParams.has("worker")) {
            urlInfo.subtype = "worker"
          } else if (urlObject.searchParams.has("service_worker")) {
            urlInfo.subtype = "service_worker"
          }
        } else {
          urlInfo.type = type
        }
      }
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
    const context = {
      ...baseContext,
      reference,
      outDirectoryUrl,
      clientRuntimeCompat,
      isSupportedOnCurrentClients: (feature) => {
        return RUNTIME_COMPAT.isSupported(clientRuntimeCompat, feature)
      },
      cook: (params) => {
        return cookDuringCook({
          outDirectoryUrl,
          clientRuntimeCompat,
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
      found: ({
        type,
        subtype,
        expectedType,
        expectedSubtype,
        line,
        column,
        specifier,
        baseUrl,
        data,
      }) => {
        return addReference({
          trace: stringifyUrlSite(
            adjustUrlSite(urlInfo, {
              urlGraph,
              url: urlInfo.url,
              line,
              column,
            }),
          ),
          type,
          subtype,
          expectedType,
          expectedSubtype,
          specifier,
          baseUrl,
          data,
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
      updateSpecifier: (generatedSpecifier, newSpecifier, data) => {
        const index = references.findIndex(
          (ref) => ref.generatedSpecifier === generatedSpecifier,
        )
        if (index === -1) {
          throw new Error(
            `Cannot find a reference for the following generatedSpecifier "${generatedSpecifier}"`,
          )
        }
        const referenceFound = references[index]
        const newReference = createReference({
          ...referenceFound,
          specifier: newSpecifier,
          data: {
            ...referenceFound.data,
            ...data,
          },
        })
        references[index] = newReference
        newReference.data.originalReference = referenceFound
        const newUrlInfo = resolveReference(newReference)
        return [newReference, newUrlInfo]
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
        const inlineUrlInfo = resolveReference(reference)
        inlineUrlInfo.isInline = true
        inlineUrlInfo.inlineUrlSite = {
          url: urlInfo.url,
          content: parentContent,
          line,
          column,
        }
        inlineUrlInfo.contentType = contentType
        inlineUrlInfo.content = content
        return reference
      },
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
          await urlInfoTransformer.applyIntermediateTransformations(
            urlInfo,
            transformReturnValue,
          )
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

    // "finalize" hook
    try {
      const finalizeReturnValue = await pluginController.callAsyncHooksUntil(
        "finalize",
        urlInfo,
        context,
      )
      await urlInfoTransformer.applyFinalTransformations(
        urlInfo,
        finalizeReturnValue,
      )
    } catch (error) {
      throw createFinalizeError({
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
    cook,
    prepareEntryPoint,
    injectReference,
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

const inferUrlInfoType = ({ contentType }) => {
  if (contentType === "text/html") {
    return "html"
  }
  if (contentType === "text/css") {
    return "css"
  }
  if (contentType === "text/javascript") {
    return "js"
  }
  if (contentType === "application/json") {
    return "json"
  }
  if (contentType === "application/importmap+json") {
    return "importmap"
  }
  return "other"
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
  const { searchParams } = new URL(url)
  if (
    searchParams.has("json_module") ||
    searchParams.has("css_module") ||
    searchParams.has("text_module")
  ) {
    url = setUrlExtension(url, ".js")
  } else if (searchParams.has("as_js_classic")) {
    url = setUrlExtension(url, ".es5.js")
  }
  return moveUrl({
    url,
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
  js_url_specifier: { encode: JSON.stringify, decode: JSON.parse },
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
