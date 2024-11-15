/*
 * This plugin provides a way for jsenv to supervisor js execution:
 * - Know how many js are executed, when they are done, collect errors, etc...
 */

import { generateContentFrame } from "@jsenv/humanize";
import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";
import { getOriginalPosition } from "@jsenv/sourcemap";
import { injectQueryParams } from "@jsenv/urls";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  injectSupervisorIntoHTML,
  supervisorFileUrl,
} from "./html_supervisor.js";

export const jsenvPluginSupervisor = ({
  logs = false,
  measurePerf = false,
  errorOverlay = true,
  openInEditor = true,
  errorBaseUrl,
}) => {
  const resolveUrlSite = (urlWithLineAndColumn) => {
    const inlineUrlMatch = urlWithLineAndColumn.match(
      /@L([0-9]+)C([0-9]+)-L([0-9]+)C([0-9]+)\.\w+(:([0-9]+):([0-9]+))?$/,
    );
    if (inlineUrlMatch) {
      const htmlUrl = injectQueryParams(
        urlWithLineAndColumn.slice(0, inlineUrlMatch.index),
        { hot: undefined },
      );
      const tagLineStart = parseInt(inlineUrlMatch[1]);
      const tagColumnStart = parseInt(inlineUrlMatch[2]);
      // const tagLineEnd = parseInt(inlineUrlMatch[3]);
      // const tagColumnEnd = parseInt(inlineUrlMatch[4]);
      const inlineLine =
        inlineUrlMatch[6] === undefined
          ? undefined
          : parseInt(inlineUrlMatch[6]);
      const inlineColumn =
        inlineUrlMatch[7] === undefined
          ? undefined
          : parseInt(inlineUrlMatch[7]);
      return {
        file: htmlUrl,
        ownerLine: tagLineStart,
        ownerColumn: tagColumnStart,
        inlineLine,
        inlineColumn,
        line:
          inlineLine === undefined ? tagLineStart : tagLineStart + inlineLine,
        column: inlineColumn === undefined ? tagColumnStart : inlineColumn,
      };
    }
    const match = urlWithLineAndColumn.match(/:([0-9]+):([0-9]+)$/);
    if (!match) {
      return null;
    }
    const file = injectQueryParams(urlWithLineAndColumn.slice(0, match.index), {
      hot: undefined,
    });
    let line = parseInt(match[1]);
    let column = parseInt(match[2]);
    return {
      file,
      line,
      column,
    };
  };

  return {
    name: "jsenv:supervisor",
    appliesDuring: "dev",
    serve: async (serveInfo) => {
      if (serveInfo.request.pathname.startsWith("/__get_cause_trace__/")) {
        const { pathname, searchParams } = new URL(serveInfo.request.url);
        const urlWithLineAndColumn = decodeURIComponent(
          pathname.slice("/__get_cause_trace__/".length),
        );
        const result = resolveUrlSite(urlWithLineAndColumn);
        if (!result) {
          return {
            status: 400,
            body: "Missing line and column in url",
          };
        }
        let { file, line, column } = result;
        const urlInfo = serveInfo.kitchen.graph.getUrlInfo(file);
        if (!urlInfo) {
          return {
            status: 204,
            headers: {
              "cache-control": "no-store",
            },
          };
        }
        if (!urlInfo.originalContent) {
          await urlInfo.fetchContent();
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
        const causeTrace = {
          url: file,
          line,
          column,
          codeFrame: generateContentFrame({
            line,
            column,
            content: urlInfo.originalContent,
          }),
        };
        const causeTraceJson = JSON.stringify(causeTrace, null, "  ");
        return {
          status: 200,
          headers: {
            "cache-control": "no-store",
            "content-type": "application/json",
            "content-length": Buffer.byteLength(causeTraceJson),
          },
          body: causeTraceJson,
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
        const { url } = applyNodeEsmResolution({
          conditions: [],
          parentUrl: serveInfo.rootDirectoryUrl,
          specifier: file,
        });
        file = url;
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
                trace: causeInfo.trace,
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
        const fileUrl = new URL(file, serveInfo.rootDirectoryUrl);
        const filePath = fileURLToPath(fileUrl);
        const require = createRequire(import.meta.url);
        const launch = require("launch-editor");
        launch(filePath, () => {
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
                  specifierLine: line,
                  specifierColumn: column,
                  specifier: inlineScriptUrl,
                  contentType: "text/javascript",
                  content: textContent,
                });
              return inlineScriptReference.generatedSpecifier;
            },
            sourcemaps: htmlUrlInfo.kitchen.context.sourcemaps,
          },
        );
      },
    },
  };
};
