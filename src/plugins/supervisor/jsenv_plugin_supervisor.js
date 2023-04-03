/*
 * This plugin provides a way for jsenv to know when js execution is done
 */

import { fileURLToPath } from "node:url"
import { getOriginalPosition } from "@jsenv/sourcemap"
import { stringifyUrlSite } from "@jsenv/urls"

import { injectSupervisorIntoHTML } from "./html_supervisor_injection.js"
import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"

export const supervisorFileUrl = new URL(
  "./client/supervisor.js",
  import.meta.url,
).href

export const jsenvPluginSupervisor = ({
  logs = false,
  measurePerf = false,
  errorOverlay = true,
  openInEditor = true,
  errorBaseUrl,
}) => {
  return {
    name: "jsenv:supervisor",
    appliesDuring: "dev",
    serve: async (request, context) => {
      if (request.pathname.startsWith("/__get_code_frame__/")) {
        const { pathname, searchParams } = new URL(request.url)
        let urlWithLineAndColumn = pathname.slice("/__get_code_frame__/".length)
        urlWithLineAndColumn = decodeURIComponent(urlWithLineAndColumn)
        const match = urlWithLineAndColumn.match(/:([0-9]+):([0-9]+)$/)
        if (!match) {
          return {
            status: 400,
            body: "Missing line and column in url",
          }
        }
        const file = urlWithLineAndColumn.slice(0, match.index)
        let line = parseInt(match[1])
        let column = parseInt(match[2])
        const urlInfo = context.urlGraph.getUrlInfo(file)
        if (!urlInfo) {
          return {
            status: 204,
            headers: {
              "cache-control": "no-store",
            },
          }
        }
        const remap = searchParams.has("remap")
        if (remap) {
          const sourcemap = urlInfo.sourcemap
          if (sourcemap) {
            const original = getOriginalPosition({
              sourcemap,
              url: file,
              line,
              column,
            })
            if (original.line !== null) {
              line = original.line
              if (original.column !== null) {
                column = original.column
              }
            }
          }
        }
        const codeFrame = stringifyUrlSite({
          url: file,
          line,
          column,
          content: urlInfo.originalContent,
        })
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(codeFrame),
          },
          body: codeFrame,
        }
      }
      if (request.pathname.startsWith("/__get_error_cause__/")) {
        let file = request.pathname.slice("/__get_error_cause__/".length)
        file = decodeURIComponent(file)
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url",
          }
        }
        const getErrorCauseInfo = () => {
          const urlInfo = context.urlGraph.getUrlInfo(file)
          if (!urlInfo) {
            return null
          }
          const { error } = urlInfo
          if (error) {
            return error
          }
          // search in direct dependencies (404 or 500)
          const { dependencies } = urlInfo
          for (const dependencyUrl of dependencies) {
            const dependencyUrlInfo = context.urlGraph.getUrlInfo(dependencyUrl)
            if (dependencyUrlInfo.error) {
              return dependencyUrlInfo.error
            }
          }
          return null
        }
        const causeInfo = getErrorCauseInfo()
        const body = JSON.stringify(
          causeInfo
            ? {
                code: causeInfo.code,
                message: causeInfo.message,
                reason: causeInfo.reason,
                stack: errorBaseUrl
                  ? `stack mocked for snapshot`
                  : causeInfo.stack,
                codeFrame: causeInfo.traceMessage,
              }
            : null,
          null,
          "  ",
        )
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        }
      }
      if (request.pathname.startsWith("/__open_in_editor__/")) {
        let file = request.pathname.slice("/__open_in_editor__/".length)
        file = decodeURIComponent(file)
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url",
          }
        }
        const launch = requireFromJsenv("launch-editor")
        launch(fileURLToPath(file), () => {
          // ignore error for now
        })
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
          },
        }
      }
      return null
    },
    transformUrlContent: {
      html: ({ url, content }, context) => {
        const [supervisorFileReference] = context.referenceUtils.inject({
          type: "script",
          expectedType: "js_classic",
          specifier: supervisorFileUrl,
        })

        return injectSupervisorIntoHTML(
          {
            content,
            url,
          },
          {
            supervisorScriptSrc: supervisorFileReference.generatedSpecifier,
            supervisorOptions: {
              errorBaseUrl,
              logs,
              measurePerf,
              errorOverlay,
              openInEditor,
            },
            webServer: {
              rootDirectoryUrl: context.rootDirectoryUrl,
              isJsenvDevServer: true,
            },
            inlineAsRemote: true,
            generateInlineScriptSrc: ({
              type,
              textContent,
              inlineScriptUrl,
              isOriginal,
              line,
              column,
            }) => {
              const [inlineScriptReference] =
                context.referenceUtils.foundInline({
                  type: "script",
                  subtype: "inline",
                  expectedType: type,
                  isOriginalPosition: isOriginal,
                  specifierLine: line - 1,
                  specifierColumn: column,
                  specifier: inlineScriptUrl,
                  contentType: "text/javascript",
                  content: textContent,
                })
              return inlineScriptReference.generatedSpecifier
            },
          },
        )
      },
    },
  }
}
