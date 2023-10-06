/*
 * This plugin provides a way for jsenv to supervisor js execution:
 * - Know how many js are executed, when they are done, collect errors, etc...
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { getOriginalPosition } from "@jsenv/sourcemap";
import { stringifyUrlSite } from "@jsenv/urls";

import {
  supervisorFileUrl,
  injectSupervisorIntoHTML,
} from "./html_supervisor.js";

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
    serve: async (serveInfo) => {
      if (serveInfo.request.pathname.startsWith("/__get_code_frame__/")) {
        const { pathname, searchParams } = new URL(serveInfo.request.url);
        let urlWithLineAndColumn = pathname.slice(
          "/__get_code_frame__/".length,
        );
        urlWithLineAndColumn = decodeURIComponent(urlWithLineAndColumn);
        const match = urlWithLineAndColumn.match(/:([0-9]+):([0-9]+)$/);
        if (!match) {
          return {
            status: 400,
            body: "Missing line and column in url",
          };
        }
        const file = urlWithLineAndColumn.slice(0, match.index);
        let line = parseInt(match[1]);
        let column = parseInt(match[2]);
        const urlInfo = serveInfo.kitchen.graph.getUrlInfo(file);
        if (!urlInfo) {
          return {
            status: 204,
            headers: {
              "cache-control": "no-store",
            },
          };
        }
        const remap = searchParams.has("remap");
        if (remap) {
          const sourcemap = urlInfo.sourcemap;
          if (sourcemap) {
            const original = getOriginalPosition({
              sourcemap,
              url: file,
              line,
              column,
            });
            if (original.line !== null) {
              line = original.line;
              if (original.column !== null) {
                column = original.column;
              }
            }
          }
        }
        const codeFrame = stringifyUrlSite({
          url: file,
          line,
          column,
          content: urlInfo.originalContent,
        });
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(codeFrame),
          },
          body: codeFrame,
        };
      }
      if (serveInfo.request.pathname.startsWith("/__get_error_cause__/")) {
        let file = serveInfo.request.pathname.slice(
          "/__get_error_cause__/".length,
        );
        file = decodeURIComponent(file);
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url",
          };
        }
        const getErrorCauseInfo = () => {
          const urlInfo = serveInfo.kitchen.graph.getUrlInfo(file);
          if (!urlInfo) {
            return null;
          }
          const { error } = urlInfo;
          if (error) {
            return error;
          }
          // search in direct dependencies (404 or 500)
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            const referencedUrlInfo = referenceToOther.urlInfo;
            if (referencedUrlInfo.error) {
              return referencedUrlInfo.error;
            }
          }
          return null;
        };
        const causeInfo = getErrorCauseInfo();
        const body = JSON.stringify(
          causeInfo
            ? {
                code: causeInfo.code,
                name: causeInfo.name,
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
        );
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        };
      }
      if (serveInfo.request.pathname.startsWith("/__open_in_editor__/")) {
        let file = serveInfo.request.pathname.slice(
          "/__open_in_editor__/".length,
        );
        file = decodeURIComponent(file);
        if (!file) {
          return {
            status: 400,
            body: "Missing file in url",
          };
        }
        const require = createRequire(import.meta.url);
        const launch = require("launch-editor");
        launch(fileURLToPath(file), () => {
          // ignore error for now
        });
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
          },
        };
      }
      return null;
    },
    transformUrlContent: {
      html: (htmlUrlInfo) => {
        const supervisorFileReference = htmlUrlInfo.dependencies.inject({
          type: "script",
          expectedType: "js_classic",
          specifier: supervisorFileUrl,
        });

        return injectSupervisorIntoHTML(
          {
            content: htmlUrlInfo.content,
            url: htmlUrlInfo.url,
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
              rootDirectoryUrl: htmlUrlInfo.context.rootDirectoryUrl,
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
              const inlineScriptReference =
                htmlUrlInfo.dependencies.foundInline({
                  type: "script",
                  subtype: "inline",
                  expectedType: type,
                  isOriginalPosition: isOriginal,
                  specifierLine: line - 1,
                  specifierColumn: column,
                  specifier: inlineScriptUrl,
                  contentType: "text/javascript",
                  content: textContent,
                });
              return inlineScriptReference.generatedSpecifier;
            },
          },
        );
      },
    },
  };
};
