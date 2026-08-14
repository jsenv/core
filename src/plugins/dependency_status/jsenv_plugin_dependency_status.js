/*
 * Tells the browser about the dependencies declared in package.json that
 * node_modules does not match, so the page can say it is running with something
 * else than what the project asks for.
 *
 * The state is sent on page load (it is known before any client connects) and
 * again whenever it changes, so a page opened during an install is updated
 * without being reloaded.
 */

import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";

const clientFileUrl = import.meta.resolve("./client/dependency_status.js");

export const jsenvPluginDependencyStatus = ({
  dependencyProblemEventEmitter,
  getDependencyProblems,
  getDependencyWatchInfo = () => ({}),
}) => {
  return {
    name: "jsenv:dependency_status",
    appliesDuring: "dev",
    serverEvents: {
      dependency_status: (serverEventInfo) => {
        dependencyProblemEventEmitter.on((problems) => {
          // the state is baked into the html by the injection below, so a page
          // served from the graph as it is would come back with the previous
          // state, which is exactly what a reload triggered by an install does
          for (const urlInfo of serverEventInfo.kitchen.graph.urlInfoMap.values()) {
            if (urlInfo.type === "html" && urlInfo.content !== undefined) {
              urlInfo.onModified();
            }
          }
          serverEventInfo.sendServerEvent({ problems });
        });
      },
    },
    transformUrlContent: {
      html: (htmlUrlInfo) => {
        const htmlAst = parseHtml({
          html: htmlUrlInfo.content,
          url: htmlUrlInfo.url,
        });
        const clientReference = htmlUrlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: clientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: clientReference.generatedSpecifier,
          initCall: {
            callee: "initDependencyStatus",
            params: {
              problems: getDependencyProblems(),
              watchInfo: getDependencyWatchInfo(),
            },
          },
          pluginName: "jsenv:dependency_status",
        });
        return {
          content: stringifyHtmlAst(htmlAst),
        };
      },
    },
  };
};
