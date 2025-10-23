/*
 * This plugin provides a way for jsenv to supervisor js execution:
 * - Know how many js are executed, when they are done, collect errors, etc...
 *
 */

import { generateContentFrame } from "@jsenv/humanize";
import { getOriginalPosition } from "@jsenv/sourcemap";
import { injectQueryParams } from "@jsenv/urls";
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
    devServerRoutes: [
      {
        endpoint: "GET /.internal/get_cause_trace/*",
        description: "Return source code around the place an error was thrown.",
        declarationSource: import.meta.url,
        fetch: async (request, { kitchen }) => {
          const urlWithLineAndColumn = decodeURIComponent(request.params[0]);
          const result = resolveUrlSite(urlWithLineAndColumn);
          if (!result) {
            return {
              status: 400,
              body: "Missing line and column in url",
            };
          }
          let { file, line, column } = result;
          const urlInfo = kitchen.graph.getUrlInfo(file);
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
          const remap = request.searchParams.has("remap");
          if (remap) {
            const sourcemap = urlInfo.sourcemap;
            if (sourcemap) {
              const original = getOriginalPosition({
                sourcemap,
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
        },
      },
      {
        endpoint: "GET /.internal/get_error_cause/*",
        description:
          "Return the error that occured when a file was served by jsenv dev server or null.",
        declarationSource: import.meta.url,
        fetch: (request, { kitchen }) => {
          let file = decodeURIComponent(request.params[0]);
          file = decodeURIComponent(file);
          if (!file) {
            return {
              status: 400,
              body: "Missing file in url",
            };
          }
          const { url } = kitchen.resolve(
            file,
            kitchen.context.rootDirectoryUrl,
          );
          file = url;
          const urlInfoVisitedSet = new Set();
          const getErrorCausingRuntimeError = (urlInfo) => {
            if (urlInfoVisitedSet.has(urlInfo)) {
              return null;
            }
            urlInfoVisitedSet.add(urlInfo);
            const { error } = urlInfo;
            if (error) {
              return error;
            }
            for (const referenceToOther of urlInfo.referenceToOthersSet) {
              const referencedUrlInfo = referenceToOther.urlInfo;
              const referencedCause =
                getErrorCausingRuntimeError(referencedUrlInfo);
              if (referencedCause) {
                return referencedCause;
              }
            }
            return null;
          };
          const urlInfo = kitchen.graph.getUrlInfo(file);
          const errorCausingRuntimeError = urlInfo
            ? getErrorCausingRuntimeError(urlInfo)
            : null;
          const body = JSON.stringify(
            errorCausingRuntimeError
              ? {
                  code: errorCausingRuntimeError.code,
                  name: errorCausingRuntimeError.name,
                  message: errorCausingRuntimeError.message,
                  reason: errorCausingRuntimeError.reason,
                  parseErrorSourceType:
                    errorCausingRuntimeError.parseErrorSourceType,
                  stack: errorBaseUrl
                    ? `stack mocked for snapshot`
                    : errorCausingRuntimeError.stack,
                  trace: errorCausingRuntimeError.trace,
                  isJsenvCookingError:
                    errorCausingRuntimeError.isJsenvCookingError,
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
        },
      },
    ],
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
              const htmlContentInjections = htmlUrlInfo.contentInjections;
              const { isPlaceholderInjection, INJECTIONS } =
                htmlUrlInfo.context;
              for (const key of Object.keys(htmlContentInjections)) {
                const injection = htmlUrlInfo.contentInjections[key];
                if (isPlaceholderInjection(injection)) {
                  inlineScriptReference.urlInfo.contentInjections[key] =
                    injection;
                  // ideally we should mark injection as optional only if it's
                  // hapenning for inline content
                  // but for now we'll just mark all html injections as optional
                  // when there is an inline script
                  htmlContentInjections[key] = INJECTIONS.optional(injection);
                }
              }
              return inlineScriptReference.generatedSpecifier;
            },
            sourcemaps: htmlUrlInfo.kitchen.context.sourcemaps,
          },
        );
      },
    },
  };
};
