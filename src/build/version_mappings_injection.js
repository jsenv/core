// https://bundlers.tooling.report/hashing/avoid-cascade/

import {
  parseHtmlString,
  injectHtmlNodeAsEarlyAsPossible,
  createHtmlNode,
  stringifyHtmlAst,
} from "@jsenv/ast";

import { isWebWorkerUrlInfo } from "@jsenv/core/src/kitchen/web_workers.js";
import { prependContent } from "../kitchen/prepend_content.js";

export const injectVersionMappingsAsGlobal = async ({
  kitchen,
  urlInfo,
  versionMappings,
}) => {
  if (urlInfo.type === "html") {
    return prependContent(urlInfo, {
      type: "js_classic",
      content: generateClientCodeForVersionMappings(versionMappings, {
        globalName: "window",
        minification: kitchen.context.minification,
      }),
    });
  }
  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    return prependContent(urlInfo, {
      type: "js_classic",
      content: generateClientCodeForVersionMappings(versionMappings, {
        globalName: isWebWorkerUrlInfo(urlInfo) ? "self" : "window",
        minification: kitchen.context.minification,
      }),
    });
  }
  return null;
};

const generateClientCodeForVersionMappings = (
  versionMappings,
  { globalName, minification },
) => {
  if (minification) {
    return `;(function(){var m = ${JSON.stringify(
      versionMappings,
    )}; ${globalName}.__v__ = function (s) { return m[s] || s }; })();`;
  }
  return `;(function() {
  var __versionMappings__ = {
    ${stringifyParams(versionMappings, "    ")}
  };
  ${globalName}.__v__ = function (specifier) {
    return __versionMappings__[specifier] || specifier
  };
})();`;
};

export const injectVersionMappingsAsImportmap = async ({
  kitchen,
  urlInfo,
  versionMappings,
}) => {
  const htmlAst = parseHtmlString(urlInfo.content, {
    storeOriginalPositions: false,
  });
  // jsenv_plugin_importmap.js is removing importmap during build
  // it means at this point we know HTML has no importmap in it
  // we can safely inject one
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      type: "importmap",
      textContent: kitchen.context.minification
        ? JSON.stringify({ imports: versionMappings })
        : JSON.stringify({ imports: versionMappings }, null, "  "),
    }),
    "jsenv:versioning",
  );
  urlInfo.mutateContent({
    content: stringifyHtmlAst(htmlAst),
  });
};

const stringifyParams = (params, prefix = "") => {
  const source = JSON.stringify(params, null, prefix);
  if (prefix.length) {
    // remove leading "{\n"
    // remove leading prefix
    // remove trailing "\n}"
    return source.slice(2 + prefix.length, -2);
  }
  // remove leading "{"
  // remove trailing "}"
  return source.slice(1, -1);
};
