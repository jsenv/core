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
      html: async (urlInfo, context) => {
        const htmlAst = parseHtmlString(urlInfo.content);
        const mutations = [];
        const actions = [];

        const onStyleSheet = (linkNode, { href }) => {
          let linkReference = null;
          for (const dependencyReference of urlInfo.dependencyReferenceSet) {
            if (
              dependencyReference.generatedSpecifier === href &&
              dependencyReference.type === "link_href" &&
              dependencyReference.subtype === "stylesheet"
            ) {
              linkReference = dependencyReference;
              break;
            }
          }
          if (
            !linkReference.original ||
            !linkReference.original.searchParams.has("inline")
          ) {
            return;
          }
          const linkUrlInfo = context.urlGraph.getUrlInfo(linkReference.url);
          actions.push(async () => {
            await linkUrlInfo.cook();
            const { line, column, isOriginal } = getHtmlNodePosition(linkNode, {
              preferOriginal: true,
            });
            linkReference.becomesInline({
              line: line - 1,
              column,
              isOriginal,
              specifier: linkReference.generatedSpecifier,
              content: linkUrlInfo.content,
              contentType: linkUrlInfo.contentType,
            });
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
              setHtmlNodeText(linkNode, linkUrlInfo.content, {
                indentation: "auto",
              });
            });
          });
        };
        const onScriptWithSrc = (scriptNode, { src }) => {
          let scriptReference;
          for (const dependencyReference of urlInfo.dependencyReferenceSet) {
            if (
              dependencyReference.generatedSpecifier === src &&
              dependencyReference.type === "script"
            ) {
              scriptReference = dependencyReference;
              break;
            }
          }
          if (
            !scriptReference.original ||
            !scriptReference.original.searchParams.has("inline")
          ) {
            return;
          }
          const scriptUrlInfo = context.urlGraph.getUrlInfo(
            scriptReference.url,
          );
          actions.push(async () => {
            await scriptUrlInfo.cook();
            const { line, column, isOriginal } = getHtmlNodePosition(
              scriptNode,
              {
                preferOriginal: true,
              },
            );
            scriptReference.becomesInline({
              line: line - 1,
              column,
              isOriginal,
              specifier: scriptReference.generatedSpecifier,
              content: scriptUrlInfo.content,
              contentType: scriptUrlInfo.contentType,
            });
            mutations.push(() => {
              setHtmlNodeAttributes(scriptNode, {
                "inlined-from-src": src,
                "src": undefined,
                "crossorigin": undefined,
                "integrity": undefined,
                "jsenv-inlined-by": "jsenv:inlining_into_html",
              });
              setHtmlNodeText(scriptNode, scriptUrlInfo.content, {
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
