import { urlToRelativeUrl } from "@jsenv/filesystem"
import { createCallbackList } from "@jsenv/abort"

import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/utils/html_ast/html_ast.js"
import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"

import { createSSEService } from "./sse_service.js"
import { collectHotDataFromHtmlAst } from "./html_hot_dependencies.js"
import { babelPluginMetadataImportMetaHot } from "./babel_plugin_metadata_import_meta_hot.js"

export const jsenvPluginAutoreload = ({
  rootDirectoryUrl,
  urlGraph,
  autoreloadPatterns,
}) => {
  return [
    jsenvPluginHmr(),
    jsenvPluginHot(),
    jsenvPluginHotSSE({
      rootDirectoryUrl,
      urlGraph,
      autoreloadPatterns,
    }),
  ]
}

const jsenvPluginHmr = () => {
  return {
    name: "jsenv:hmr",
    appliesDuring: { dev: true },
    normalizeUrl: (reference) => {
      const urlObject = new URL(reference.url)
      if (!urlObject.searchParams.has("hmr")) {
        reference.data.hmr = false
        return null
      }
      reference.data.hmr = true
      // "hmr" search param goal is to mark url as enabling hmr:
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      urlObject.searchParams.delete("hmr")
      urlObject.searchParams.delete("v")
      return urlObject.href
    },
    transformUrlSearchParams: (reference, context) => {
      const parentUrlInfo = context.urlGraph.getUrlInfo(reference.parentUrl)
      if (!parentUrlInfo || !parentUrlInfo.data.hmr) {
        return null
      }
      const urlInfo = context.urlGraph.getUrlInfo(reference.url)
      if (!urlInfo.data.hmrTimestamp) {
        return null
      }
      return {
        hmr: "",
        v: urlInfo.data.hmrTimestamp,
      }
    },
  }
}

const jsenvPluginHot = () => {
  const eventSourceClientFileUrl = new URL(
    "./client/event_source_client.js",
    import.meta.url,
  ).href
  const importMetaHotClientFileUrl = new URL(
    "./client/import_meta_hot.js",
    import.meta.url,
  ).href

  return {
    name: "jsenv:hot",
    appliesDuring: { dev: true },
    transformUrlContent: {
      html: (htmlUrlInfo, context) => {
        const htmlAst = parseHtmlString(htmlUrlInfo.content)
        const { hotReferences } = collectHotDataFromHtmlAst(htmlAst)
        htmlUrlInfo.data.hotDecline = false
        htmlUrlInfo.data.hotAcceptSelf = false
        htmlUrlInfo.data.hotAcceptDependencies = hotReferences.map(
          ({ type, specifier }) => {
            const [reference] = context.referenceUtils.found({
              type,
              specifier,
            })
            return reference.url
          },
        )
        const [eventSourceClientReference] = context.referenceUtils.inject({
          type: "script_src",
          expectedType: "js_module",
          specifier: eventSourceClientFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            "tagName": "script",
            "type": "module",
            "src": eventSourceClientReference.generatedSpecifier,
            "injected-by": "jsenv:hot",
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
      css: (cssUrlInfo) => {
        cssUrlInfo.data.hotDecline = false
        cssUrlInfo.data.hotAcceptSelf = false
        cssUrlInfo.data.hotAcceptDependencies = []
      },
      js_module: async (urlInfo, context) => {
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          urlInfo,
        })
        const {
          importMetaHotDetected,
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies,
        } = metadata
        urlInfo.data.hotDecline = hotDecline
        urlInfo.data.hotAcceptSelf = hotAcceptSelf
        urlInfo.data.hotAcceptDependencies = hotAcceptDependencies
        if (!importMetaHotDetected) {
          return null
        }
        // For some reason using magic source here produce
        // better sourcemap than doing the equivalent with babel
        // I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
        // which is likely not well supported by babel
        const [importMetaHotClientFileReference] =
          context.referenceUtils.inject({
            parentUrl: urlInfo.url,
            type: "js_import_export",
            expectedType: "js_module",
            specifier: importMetaHotClientFileUrl,
          })
        const magicSource = createMagicSource(urlInfo.content)
        magicSource.prepend(
          `import { createImportMetaHot } from ${importMetaHotClientFileReference.generatedSpecifier}
import.meta.hot = createImportMetaHot(import.meta.url)
`,
        )
        return magicSource.toContentAndSourcemap()
      },
    },
  }
}

const jsenvPluginHotSSE = ({
  rootDirectoryUrl,
  urlGraph,
  autoreloadPatterns,
}) => {
  const hotUpdateCallbackList = createCallbackList()
  const notifyDeclined = ({ cause, reason, declinedBy }) => {
    hotUpdateCallbackList.notify({
      declined: true,
      cause,
      reason,
      declinedBy,
    })
  }
  const notifyAccepted = ({ cause, reason, instructions }) => {
    hotUpdateCallbackList.notify({
      accepted: true,
      cause,
      reason,
      instructions,
    })
  }
  const updateHmrTimestamp = (urlInfo, hmrTimestamp) => {
    const urlInfos = urlGraph.urlInfos
    const seen = []
    const iterate = (urlInfo) => {
      if (seen.includes(urlInfo.url)) {
        return
      }
      seen.push(urlInfo.url)
      urlInfo.data.hmrTimestamp = hmrTimestamp
      urlInfo.dependents.forEach((dependentUrl) => {
        const dependentUrlInfo = urlInfos[dependentUrl]
        if (
          !dependentUrlInfo.data.hotAcceptDependencies.includes(urlInfo.url)
        ) {
          iterate(dependentUrlInfo, hmrTimestamp)
        }
      })
    }
    iterate(urlInfo)
  }
  const propagateUpdate = (firstUrlInfo) => {
    const urlInfos = urlGraph.urlInfos
    const iterate = (urlInfo, trace) => {
      if (urlInfo.data.hotAcceptSelf) {
        return {
          accepted: true,
          reason:
            urlInfo === firstUrlInfo
              ? `file accepts hot reload`
              : `a dependent file accepts hot reload`,
          instructions: [
            {
              type: urlInfo.type,
              boundary: urlToRelativeUrl(urlInfo.url, rootDirectoryUrl),
              acceptedBy: urlToRelativeUrl(urlInfo.url, rootDirectoryUrl),
            },
          ],
        }
      }
      const { dependents } = urlInfo
      const instructions = []
      for (const dependentUrl of dependents) {
        const dependentUrlInfo = urlInfos[dependentUrl]
        if (dependentUrlInfo.data.hotDecline) {
          return {
            declined: true,
            reason: `a dependent file declines hot reload`,
            declinedBy: dependentUrl,
          }
        }
        if (dependentUrlInfo.data.hotAcceptDependencies.includes(urlInfo.url)) {
          instructions.push({
            type: dependentUrlInfo.type,
            boundary: urlToRelativeUrl(dependentUrl, rootDirectoryUrl),
            acceptedBy: urlToRelativeUrl(urlInfo.url, rootDirectoryUrl),
          })
          continue
        }
        if (trace.includes(dependentUrl)) {
          return {
            declined: true,
            reason: "circular dependency",
            declinedBy: urlToRelativeUrl(dependentUrl, rootDirectoryUrl),
          }
        }
        const dependentPropagationResult = iterate(dependentUrlInfo, [
          ...trace,
          dependentUrl,
        ])
        if (dependentPropagationResult.accepted) {
          instructions.push(...dependentPropagationResult.instructions)
          continue
        }
        if (
          // declined explicitely by an other file, it must decline the whole update
          dependentPropagationResult.declinedBy
        ) {
          return dependentPropagationResult
        }
        // declined by absence of boundary, we can keep searching
        continue
      }
      if (instructions.length === 0) {
        return {
          declined: true,
          reason: `there is no file accepting hot reload while propagating update`,
        }
      }
      return {
        accepted: true,
        reason: `${instructions.length} dependent file(s) accepts hot reload`,
        instructions,
      }
    }
    const trace = []
    return iterate(firstUrlInfo, trace)
  }
  const sseService = createSSEService({
    rootDirectoryUrl,
    autoreloadPatterns,
    onFileChange: ({ relativeUrl, event }) => {
      const url = new URL(relativeUrl, rootDirectoryUrl).href
      const urlInfo = urlGraph.urlInfos[url]
      // file not part of dependency graph
      if (!urlInfo) {
        return
      }
      updateHmrTimestamp(urlInfo, Date.now())
      const hotUpdate = propagateUpdate(urlInfo)
      if (hotUpdate.declined) {
        notifyDeclined({
          cause: `${relativeUrl} ${event}`,
          reason: hotUpdate.reason,
          declinedBy: hotUpdate.declinedBy,
        })
      } else {
        notifyAccepted({
          cause: `${relativeUrl} ${event}`,
          reason: hotUpdate.reason,
          instructions: hotUpdate.instructions,
        })
      }
    },
    hotUpdateCallbackList,
  })
  urlGraph.prunedCallbackList.add(({ prunedUrlInfos, firstUrlInfo }) => {
    prunedUrlInfos.forEach((prunedUrlInfo) => {
      prunedUrlInfo.data.hmrTimestamp = Date.now()
      // should we delete instead?
      // delete urlGraph.urlInfos[prunedUrlInfo.url]
    })
    const mainHotUpdate = propagateUpdate(firstUrlInfo)
    const cause = `following files are no longer referenced: ${prunedUrlInfos.map(
      (prunedUrlInfo) => urlToRelativeUrl(prunedUrlInfo.url, rootDirectoryUrl),
    )}`
    // now check if we can hot update the main ressource
    // then if we can hot update all dependencies
    if (mainHotUpdate.declined) {
      notifyDeclined({
        cause,
        reason: mainHotUpdate.reason,
        declinedBy: mainHotUpdate.declinedBy,
      })
      return
    }
    // main can hot update
    let i = 0
    const instructions = []
    while (i < prunedUrlInfos.length) {
      const prunedUrlInfo = prunedUrlInfos[i++]
      if (prunedUrlInfo.data.hotDecline) {
        notifyDeclined({
          cause,
          reason: `a pruned file declines hot reload`,
          declinedBy: urlToRelativeUrl(prunedUrlInfo.url, rootDirectoryUrl),
        })
        return
      }
      instructions.push({
        type: "prune",
        boundary: urlToRelativeUrl(prunedUrlInfo.url, rootDirectoryUrl),
        acceptedBy: urlToRelativeUrl(firstUrlInfo.url, rootDirectoryUrl),
      })
    }
    notifyAccepted({
      cause,
      reason: mainHotUpdate.reason,
      instructions,
    })
  })

  return {
    name: "jsenv:hot_sse",
    appliesDuring: { dev: true },
    serve: (request, { urlGraph, rootDirectoryUrl }) => {
      if (request.ressource === "/__graph__") {
        const graphJson = JSON.stringify(urlGraph.toJSON(rootDirectoryUrl))
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(graphJson),
          },
          body: graphJson,
        }
      }
      const { accept } = request.headers
      if (accept && accept.includes("text/event-stream")) {
        const room = sseService.getOrCreateSSERoom(request)
        return room.join(request)
      }
      return null
    },
    destroy: () => {
      sseService.destroy()
    },
  }
}
