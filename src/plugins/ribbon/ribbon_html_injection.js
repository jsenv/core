/*
 * Inject the ribbon into an html string, inlining the client code.
 *
 * Used when serving files that must not be modified on the filesystem (the build
 * directory served by startBuildServer): the ribbon exists only in what the
 * server sends, never in the artifact that gets deployed.
 */

import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";
import { readFileSync } from "node:fs";

const ribbonClientFileUrl = import.meta.resolve("./client/ribbon.js");
let ribbonClientFileContent;

export const injectRibbonIntoHtml = (
  html,
  { text = "BUILD", color, textColor, href, target, position } = {},
) => {
  if (ribbonClientFileContent === undefined) {
    ribbonClientFileContent = String(
      readFileSync(new URL(ribbonClientFileUrl)),
    );
  }
  const htmlAst = parseHtml({ html, url: "file:///ribbon.html" });
  const params = { text, color, textColor, href, target, position };
  for (const key of Object.keys(params)) {
    if (params[key] === undefined) {
      delete params[key];
    }
  }
  injectJsenvScript(htmlAst, {
    type: "module",
    content: `${ribbonClientFileContent}
injectRibbon(${JSON.stringify(params)});`,
    pluginName: "jsenv:ribbon",
  });
  return stringifyHtmlAst(htmlAst);
};
