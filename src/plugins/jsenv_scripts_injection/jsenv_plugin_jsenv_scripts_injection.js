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

export const jsenvScriptsFileUrl = new URL(
  "./client/jsenv_scripts.js",
  import.meta.url,
);

export const jsenvPluginJsenvScriptsInjection = () => {
  return {
    name: "jsenv:jsenv_scripts_injection",
    appliesDuring: "*",
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
      // c'est un peu risqué d'attendre que le browser fetch parce qu'alors
      // on peut avoir perdu firstReference.ownerUrlInfo
      // (rien ne garanti que le browser fera la requete via le HTML)
      // mais on pour l'instant ok
      js_classic: (urlInfo) => {
        if (urlInfo.url !== jsenvScriptsFileUrl.href) {
          return null;
        }
        const { scriptInjections } = urlInfo.firstReference.ownerUrlInfo;
        return generateJsenvScriptsContent(urlInfo, scriptInjections);
      },
    },
  };
};

const generateJsenvScriptsContent = async (urlInfo, scriptInjections) => {
  const scriptReferences = [];
  for (const scriptInjection of scriptInjections) {
    const scriptReference = urlInfo.dependencies.inject({
      type: "script",
      subtype: "js_classic",
      expectedType: "js_classic",
      specifier: scriptInjection.src,
    });
    scriptReferences.push(scriptReference);
  }
  await Promise.all(
    scriptReferences.map(async (scriptReference) => {
      await scriptReference.urlInfo.cook();
    }),
  );

  let setupContent = "";
  let content = "";
  let i = 0;
  while (i < scriptInjections.length) {
    const scriptInjection = scriptInjections[i];
    const scriptReference = scriptReferences[i];
    content += `// injected by "${scriptInjection.pluginName}"`;
    content += "\n";
    content += `(function () {`;
    content += "\n";
    content += scriptReference.urlInfo.content;
    content += "\n";
    content += `})();`;
    content += "\n\n";
    const { setup } = scriptInjection;
    if (setup) {
      const setupGlobalName = setup.name;
      const setupParamSource = stringifyParams(setup.param, "  ");
      const inlineJs = `${setupGlobalName}({${setupParamSource}})`;
      setupContent += inlineJs;
      setupContent += "\n\n";
    }
    i++;
  }
  let finalContent = "";
  finalContent += content;
  if (setupContent) {
    finalContent += "// Setup";
    finalContent += "\n";
    finalContent += setupContent;
  }

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
