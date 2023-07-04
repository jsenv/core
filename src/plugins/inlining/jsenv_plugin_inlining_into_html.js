import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlNodes,
  getHtmlNodeText,
  analyzeScriptNode,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  setHtmlNodeText,
  getHtmlNodePosition,
} from "@jsenv/ast";

export const jsenvPluginInliningIntoHtml = () => {
  return {
    name: "jsenv:inlining_into_html",
    appliesDuring: "*",
    transformUrlContent: {
      html: async (urlInfo) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        const mutations = [];
        const actions = [];

        const onStyleSheet = (linkNode, { href }) => {
          let linkReference = null;
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            if (
              referenceToOther.generatedSpecifier === href &&
              referenceToOther.type === "link_href" &&
              referenceToOther.subtype === "stylesheet"
            ) {
              linkReference = referenceToOther;
              break;
            }
          }
          if (!linkReference.searchParams.has("inline")) {
            return;
          }
          const { line, column, isOriginal } = getHtmlNodePosition(linkNode, {
            preferOriginal: true,
          });
          const linkInlineReference = linkReference.becomesInline({
            line: line - 1,
            column,
            isOriginal,
            specifier: linkReference.specifier,
          });
          const linkInlineUrlInfo = linkInlineReference.urlInfo;

          actions.push(async () => {
            await linkInlineUrlInfo.cook();
            mutations.push(() => {
              setHtmlNodeAttributes(linkNode, {
                "inlined-from-href": href,
                "href": undefined,
                "rel": undefined,
                "type": undefined,
                "as": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html",
              });
              linkNode.nodeName = "style";
              linkNode.tagName = "style";
              setHtmlNodeText(linkNode, linkInlineUrlInfo.content, {
                indentation: "auto",
              });
            });
          });
        };
        const onScriptWithSrc = (scriptNode, { src }) => {
          let scriptReference;
          for (const dependencyReference of urlInfo.referenceToOthersSet) {
            if (
              dependencyReference.generatedSpecifier === src &&
              dependencyReference.type === "script"
            ) {
              scriptReference = dependencyReference;
              break;
            }
          }
          if (!scriptReference.searchParams.has("inline")) {
            return;
          }
          const { line, column, isOriginal } = getHtmlNodePosition(scriptNode, {
            preferOriginal: true,
          });
          const scriptInlineReference = scriptReference.becomesInline({
            line: line - 1,
            column,
            isOriginal,
            specifier: scriptReference.specifier,
          });
          const scriptInlineUrlInfo = scriptInlineReference.urlInfo;
          actions.push(async () => {
            await scriptInlineUrlInfo.cook();
            mutations.push(() => {
              setHtmlNodeAttributes(scriptNode, {
                "inlined-from-src": src,
                "src": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html",
              });
              setHtmlNodeText(scriptNode, scriptInlineUrlInfo.content, {
                indentation: "auto",
              });
            });
          });
        };

        visitHtmlNodes(htmlAst, {
          link: (linkNode) => {
            const rel = getHtmlNodeAttribute(linkNode, "rel");
            if (rel !== "stylesheet") {
              return;
            }
            const href = getHtmlNodeAttribute(linkNode, "href");
            if (!href) {
              return;
            }
            onStyleSheet(linkNode, { href });
          },
          script: (scriptNode) => {
            const { type } = analyzeScriptNode(scriptNode);
            const scriptNodeText = getHtmlNodeText(scriptNode);
            if (scriptNodeText) {
              return;
            }
            const src = getHtmlNodeAttribute(scriptNode, "src");
            if (!src) {
              return;
            }
            onScriptWithSrc(scriptNode, { type, src });
          },
        });
        if (actions.length > 0) {
          await Promise.all(actions.map((action) => action()));
        }
        mutations.forEach((mutation) => mutation());
        const htmlModified = stringifyHtmlAst(htmlAst);
        return htmlModified;
      },
    },
  };
};
