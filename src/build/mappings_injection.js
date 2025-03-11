// https://bundlers.tooling.report/hashing/avoid-cascade/

import {
  createHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
  parseHtml,
  stringifyHtmlAst,
} from "@jsenv/ast";

import { isWebWorkerUrlInfo } from "@jsenv/core/src/kitchen/web_workers.js";
import { prependContent } from "../kitchen/prepend_content.js";

export const injectGlobalMappings = async (urlInfo, mappings) => {
  if (urlInfo.type === "html") {
    const minification = Boolean(
      urlInfo.context.getPluginMeta("willMinifyJsClassic"),
    );
    const content = generateClientCodeForMappings(mappings, {
      globalName: "window",
      minification,
    });
    await prependContent(urlInfo, { type: "js_classic", content });
    return;
  }
  if (urlInfo.type === "js_classic" || urlInfo.type === "js_module") {
    const minification = Boolean(
      urlInfo.context.getPluginMeta("willMinifyJsClassic"),
    );
    const content = generateClientCodeForMappings(mappings, {
      globalName: isWebWorkerUrlInfo(urlInfo) ? "self" : "window",
      minification,
    });
    await prependContent(urlInfo, { type: "js_classic", content });
    return;
  }
};

const generateClientCodeForMappings = (
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

export const injectImportmapMappings = (urlInfo, mappings) => {
  const htmlAst = parseHtml({
    html: urlInfo.content,
    url: urlInfo.url,
    storeOriginalPositions: false,
  });
  // jsenv_plugin_importmap.js is removing importmap during build
  // it means at this point we know HTML has no importmap in it
  // we can safely inject one
  const importmapMinification = Boolean(
    urlInfo.context.getPluginMeta("willMinifyJson"),
  );
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      type: "importmap",
      children: importmapMinification
        ? JSON.stringify({ imports: mappings })
        : JSON.stringify({ imports: mappings }, null, "  "),
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
