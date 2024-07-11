/*
 * For now we'll support only classic scripts
 * but we could have an other set of js module scripts
 * in a file like jsenv_js_module_scripts
 */

import {
  parseHtml,
  stringifyHtmlAst,
  injectHtmlNodeAsEarlyAsPossible,
  createHtmlNode,
} from "@jsenv/ast";

export const jsenvPluginJsenvScriptsInjection = () => {
  const jsenvScriptsFileUrl = new URL("./jsenv_scripts.js", import.meta.url);

  return {
    name: "jsenv:jsenv_scripts_injection",
    appliesDuring: "*",
    fetchUrlContent: {
      js_classic: (urlInfo) => {
        if (urlInfo.url !== jsenvScriptsFileUrl.href) {
          return null;
        }
        const { scriptInjections } = urlInfo;
        return generateJsenvScriptsContent(scriptInjections);
      },
    },
    transformUrlContent: {
      html: (urlInfo) => {
        const { scriptInjections } = urlInfo;
        if (scriptInjections.length === 0) {
          return null;
        }
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const scriptReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_classic",
          expectedType: "js_classic",
          specifier: jsenvScriptsFileUrl.href,
        });
        injectHtmlNodeAsEarlyAsPossible(
          htmlAst,
          createHtmlNode({
            tagName: "script",
            src: scriptReference.generatedSpecifier,
          }),
          "jsenv:jsenv_scripts_injection",
        );
        const htmlModified = stringifyHtmlAst(htmlAst);
        return {
          content: htmlModified,
        };
      },
    },
  };
};

const generateJsenvScriptsContent = async (scriptInjections) => {
  // TODO: generate jsenv_client.js dynamically
  // with the result of all the scripts
  // ideally we should cook subfiles
  // we should also use rollup to bundle
  let content = "";
  let setupContent = "";
  for (const scriptInjection of scriptInjections) {
    content += "yep"; // TODO: the corresponding script content
    const { setup } = scriptInjection;
    if (setup) {
      const setupGlobalName = setup.name;
      const setupParamSource = stringifyParams(setup.param, "  ");
      const inlineJs = `${setupGlobalName}({${setupParamSource}})`;
      setupContent += inlineJs;
    }
  }

  let finalContent = "";
  finalContent += content;
  finalContent += setupContent;
  return finalContent;
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
