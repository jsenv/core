import { urlToRelativeUrl } from "@jsenv/filesystem"
import { createCallbackList } from "@jsenv/abort"

import { injectQueryParams } from "@jsenv/core/src/utils/url_utils.js"
import { createMagicSource } from "@jsenv/core/src/utils/sourcemap/magic_source.js"
import {
  parseHtmlString,
  stringifyHtmlAst,
  injectScriptAsEarlyAsPossible,
  createHtmlNode,
  parseLinkNode,
} from "@jsenv/core/src/utils/html_ast/html_ast.js"
import { applyBabelPlugins } from "@jsenv/core/src/utils/js_ast/apply_babel_plugins.js"

import { createSSEService } from "./sse_service.js"
import { babelPluginMetadataImportMetaHot } from "./babel_plugin_metadata_import_meta_hot.js"
import { data } from "@jsenv/core/old_test/assets/json/importing_json/json_with_dynamic_import_assertion/main.js"

export const jsenvPluginAutoreload = ({
  stopCallbackList,
  rootDirectoryUrl,
  urlGraph,
  autoreloadPatterns,
}) => {
  const eventSourceFileUrl = new URL(
    "./client/event_source_client.js",
    import.meta.url,
  ).href
  const importMetaHotClientFileUrl = new URL(
    "./client/import_meta_hot_module.js",
    import.meta.url,
  ).href

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
    const iterate = (url) => {
      if (seen.includes(url)) {
        return
      }
      seen.push(url)
      const urlInfo = urlInfos[url]
      urlInfo.data.hmrTimestamp = hmrTimestamp
      urlInfo.dependents.forEach((dependentUrl) => {
        const dependent = urlInfo[dependentUrl]
        if (!dependent.data.hotAcceptDependencies.includes(url)) {
          iterate(dependentUrl, hmrTimestamp)
        }
      })
    }
    iterate(urlInfo.url)
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
        const dependent = urlInfos[dependentUrl]
        if (dependent.data.hotDecline) {
          return {
            declined: true,
            reason: `a dependent file declines hot reload`,
            declinedBy: dependentUrl,
          }
        }
        if (dependent.data.hotAcceptDependencies.includes(urlInfo.url)) {
          instructions.push({
            type: dependent.type,
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
        const dependentPropagationResult = iterate(dependent, [
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
  const getOrCreateSSERoom = createSSEService({
    rootDirectoryUrl,
    stopCallbackList,
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
  urlGraph.prunedCallbackList.add((prunedUrlInfos, ancestorUrlInfo) => {
    prunedUrlInfos.forEach((prunedUrlInfo) => {
      prunedUrlInfo.data.hmrTimestamp = Date.now()
      // should we delete instead?
      // delete urlGraph.urlInfos[prunedUrlInfo.url]
    })
    const mainHotUpdate = propagateUpdate(ancestorUrlInfo)
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
        acceptedBy: urlToRelativeUrl(ancestorUrlInfo.url, rootDirectoryUrl),
      })
    }
    notifyAccepted({
      cause,
      reason: mainHotUpdate.reason,
      instructions,
    })
  })

  const autoreloadPlugin = {
    name: "jsenv:autoreload",
    appliesDuring: {
      dev: true,
    },
    serve: (request, { urlGraph }) => {
      if (request.ressource === "/__graph__") {
        const graphJson = JSON.stringify(urlGraph)
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
        const room = getOrCreateSSERoom(request)
        return room.join(request)
      }
      return null
    },
    normalize: ({ url, data }) => {
      if (!urlObject.searchParams.has("hmr")) {
        data.hmr = false
        return null
      }
      data.hmr = true
      // "hmr" search param goal is to mark url as enabling hmr:
      // this goal is achieved when we reach this part of the code
      // We get rid of this params so that urlGraph and other parts of the code
      // recognize the url (it is not considered as a different url)
      const urlObject = new URL(url)
      urlObject.searchParams.delete("hmr")
      urlObject.searchParams.delete("v")
      return urlObject.href
    },
    transform: {
      html: async ({ content }, { rootDirectoryUrl, resolveSpecifier }) => {
        const htmlAst = parseHtmlString(content)
        const eventSourceResolvedUrl = resolveSpecifier({
          parentUrl: rootDirectoryUrl,
          type: "js_import_export",
          specifier: eventSourceFileUrl,
        })
        injectScriptAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            type: "module",
            src: eventSourceResolvedUrl,
          }),
        )
        const htmlModified = stringifyHtmlAst(htmlAst)
        return {
          content: htmlModified,
        }
      },
      js_module: async ({ url, content }) => {
        const { metadata } = await applyBabelPlugins({
          babelPlugins: [babelPluginMetadataImportMetaHot],
          url,
          content,
        })
        const { importMetaHotDetected } = metadata
        if (!importMetaHotDetected) {
          return null
        }
        // For some reason using magic source here produce
        // better sourcemap than doing the equivalent with babel
        // I suspect it's because I was doing injectAstAfterImport(programPath, ast.program.body[0])
        // which is likely not well supported by babel
        const magicSource = createMagicSource({
          url,
          content,
        })
        magicSource.prepend(
          `import { createImportMetaHot } from "${importMetaHotClientFileUrl}"
    import.meta.hot = createImportMetaHot(import.meta.url)
    `,
        )
        return magicSource.toContentAndSourcemap()
      },
    },
    referencesResolved: {
      html: ({ references }) => {
        // All url mention objects having "hotAccepted" property will be added
        // to "hotAcceptDependencies"
        // For html there is some "smart" default applied in "collectHtmlDependenciesFromAst"
        // to decide what should hot reload / fullreload:
        // By default:
        //   - hot reload on <img src="./image.png" />
        //   - fullreload on <script src="./file.js" />
        // Can be controlled by [hot-decline] and [hot-accept]:
        //   - fullreload on <img src="./image.png" hot-decline />
        //   - hot reload on <script src="./file.js" hot-accept />
        const hotAcceptDependencies = []
        references.forEach((reference) => {
          if (reference.hotAccepted === false) {
            return
          }
          if (reference.hotAccepted === true) {
            hotAcceptDependencies.push(reference.url)
            return
          }
          if (htmlReferenceAcceptsHotByDefault(reference)) {
            hotAcceptDependencies.push(reference.url)
            return
          }
        })
        data.hotDecline = false
        data.hotAcceptSelf = false
        data.hotAcceptDependencies = hotAcceptDependencies
      },
      css: ({ data }) => {
        data.hotDecline = false
        data.hotAcceptSelf = false
        data.hotAcceptDependencies = []
      },
      js_module: ({ data }) => {
        data.hotDecline = false
        data.hotAcceptSelf = false
        data.hotAcceptDependencies = []
      },
    },
    transformReferencedUrl: ({ url, data }) => {
      if (!data.hmr) {
        return null
      }
      if (!data.hmrTimestamp) {
        return null
      }
      return injectQueryParams(url, {
        hmr: "",
        v: data.hmrTimestamp,
      })
    },
  }
  return autoreloadPlugin
}

const htmlReferenceAcceptsHotByDefault = (reference) => {
  if (reference.type === "link_href") {
    const { isStylesheet, isRessourceHint } = parseLinkNode(node)
    if (isStylesheet) {
      // stylesheets can be hot replaced by default
      return true
    }
    if (isRessourceHint) {
      // for ressource hints html will be notified the underlying ressource has changed
      // but we won't do anything (if the ressource is deleted we should?)
      return true
    }
    return false
  }
  return [
    // "script_src", // script src cannot hot reload
    "a_href",
    // Iframe will have their own event source client
    // and can hot reload independently
    // But if the iframe communicates with the parent iframe
    // then we canot know for sure if the communication is broken
    // ideally, if the iframe full-reload the page must full-reload too
    // if the iframe hot-reload we don't know but we could assume there is nothing to do
    // if there is [hot-accept] on the iframe
    "iframe_src",
    "img_src",
    "img_srcset",
    "source_src",
    "source_srcset",
    "image_href",
    "use_href",
  ].includes(reference.type)
}
