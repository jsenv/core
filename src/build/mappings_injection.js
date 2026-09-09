// https://bundlers.tooling.report/hashing/avoid-cascade/

import {
  createHtmlNode,
  findHtmlNode,
  getHtmlNodeAttribute,
  getHtmlNodeText,
  injectHtmlNodeAsEarlyAsPossible,
  parseHtml,
  removeHtmlNode,
  setHtmlNodeText,
  stringifyHtmlAst,
} from "@jsenv/ast";

import { isWebWorkerUrlInfo } from "@jsenv/core/src/kitchen/web_workers.js";
import { prependContent } from "../kitchen/prepend_content.js";

// we nevery minify those because they are already very small
// and would hurt the readability of something that can be critical to debug
export const injectGlobalMappings = async (urlInfo, mappings) => {
  if (
    urlInfo.type !== "html" &&
    urlInfo.type !== "js_classic" &&
    urlInfo.type !== "js_module"
  ) {
    return;
  }
  // const minification = Boolean(
  //   urlInfo.context.getPluginMeta("willMinifyJsClassic"),
  // );
  const content = generateClientCodeForMappings(mappings, {
    globalName: getGlobalName(urlInfo),
    minification: false,
  });
  await prependContent(urlInfo, { type: "js_classic", content });
};

// "globalThis" names the global object in a window and in a worker alike;
// the window/self split is only for runtimes predating it.
const getGlobalName = (urlInfo) => {
  if (urlInfo.context.isSupportedOnCurrentClients("global_this")) {
    return "globalThis";
  }
  if (isWebWorkerUrlInfo(urlInfo)) {
    return "self";
  }
  return "window";
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

export const injectImportmapMappings = (urlInfo, getMappings) => {
  const htmlAst = parseHtml({
    html: urlInfo.content,
    url: urlInfo.url,
    storeOriginalPositions: false,
  });
  // jsenv_plugin_importmap.js is removing importmap during build
  // it means at this point we know HTML has no importmap in it
  // we can safely inject one
  const importmapMinification = false;
  // Boolean(urlInfo.context.getPluginMeta("willMinifyJson"));
  const importmapNode = findHtmlNode(htmlAst, (node) => {
    return (
      node.tagName === "script" &&
      getHtmlNodeAttribute(node, "type") === "importmap"
    );
  });
  const generateMappingText = (mappings) => {
    if (importmapMinification) {
      return JSON.stringify({ imports: mappings });
    }
    return JSON.stringify({ imports: mappings }, null, "  ");
  };

  const mutate = (mutation) => {
    mutation();
    urlInfo.mutateContent({
      content: stringifyHtmlAst(htmlAst),
    });
  };

  if (importmapNode) {
    // we want to remove some mappings, override others, add eventually add new
    const currentMappings = JSON.parse(getHtmlNodeText(importmapNode));
    const mappings = getMappings(currentMappings.imports);
    if (!mappings || Object.keys(mappings).length === 0) {
      mutate(() => {
        removeHtmlNode(importmapNode);
      });
      return;
    }
    mutate(() => {
      setHtmlNodeText(importmapNode, generateMappingText(mappings), {
        indentation: "auto",
      });
    });
    return;
  }
  const mappings = getMappings(null);
  if (!mappings || Object.keys(mappings).length === 0) {
    return;
  }
  mutate(() => {
    injectHtmlNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        type: "importmap",
        children: generateMappingText(getMappings(null)),
      }),
      "jsenv:versioning",
    );
  });
  return;
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
