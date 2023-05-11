import { parse, serialize, parseFragment } from "parse5";

import { insertHtmlNodeAfter, insertHtmlNodeBefore } from "./html_node.js";
import {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html_node_attributes.js";
import {
  storeHtmlNodePosition,
  storeHtmlNodeAttributePosition,
} from "./html_node_position.js";
import { findHtmlChildNode, visitHtmlNodes } from "./html_search.js";
import { getHtmlNodeText } from "./html_node_text.js";

export const parseHtmlString = (
  htmlString,
  { storeOriginalPositions = true } = {},
) => {
  const htmlAst = parse(htmlString, { sourceCodeLocationInfo: true });
  if (storeOriginalPositions) {
    const htmlNode = findHtmlChildNode(
      htmlAst,
      (node) => node.nodeName === "html",
    );
    const stored = getHtmlNodeAttribute(htmlNode, "original-position-stored");
    if (stored === undefined) {
      visitHtmlNodes(htmlAst, {
        "*": (node) => {
          if (node.nodeName === "script" || node.nodeName === "style") {
            const htmlNodeText = getHtmlNodeText(node);
            if (htmlNodeText !== undefined) {
              storeHtmlNodePosition(node);
            }
          }
          storeHtmlNodeAttributePosition(node, "src");
          storeHtmlNodeAttributePosition(node, "href");
        },
      });
      setHtmlNodeAttributes(htmlNode, {
        "original-position-stored": "",
      });
    }
  }
  const htmlNode = htmlAst.childNodes.find((node) => node.nodeName === "html");
  if (htmlNode) {
    const bodyNode = htmlNode.childNodes.find(
      (node) => node.nodeName === "body",
    );
    // for some reason "parse5" adds "\n\n" to the last text node of <body>
    const lastBodyNode = bodyNode.childNodes[bodyNode.childNodes.length - 1];
    if (
      lastBodyNode &&
      lastBodyNode.nodeName === "#text" &&
      lastBodyNode.value.endsWith("\n\n")
    ) {
      lastBodyNode.value = lastBodyNode.value.slice(0, -2);
    }
  }
  return htmlAst;
};

export const stringifyHtmlAst = (
  htmlAst,
  { cleanupJsenvAttributes = false, cleanupPositionAttributes = false } = {},
) => {
  if (cleanupJsenvAttributes || cleanupPositionAttributes) {
    const htmlNode = findHtmlChildNode(
      htmlAst,
      (node) => node.nodeName === "html",
    );
    const storedAttribute = getHtmlNodeAttribute(
      htmlNode,
      "original-position-stored",
    );
    if (storedAttribute !== undefined) {
      setHtmlNodeAttributes(htmlNode, {
        "original-position-stored": undefined,
      });
      visitHtmlNodes(htmlAst, {
        "*": (node) => {
          setHtmlNodeAttributes(node, {
            "original-position": undefined,
            "original-src-position": undefined,
            "original-href-position": undefined,
            ...(cleanupJsenvAttributes
              ? {
                  "inlined-from-src": undefined,
                  "inlined-from-href": undefined,
                  "jsenv-cooked-by": undefined,
                  "jsenv-inlined-by": undefined,
                  "jsenv-injected-by": undefined,
                  "jsenv-debug": undefined,
                  "content-indented": undefined,
                }
              : {}),
          });
        },
      });
    }
  }
  // ensure body and html have \n
  ensureLineBreaksBetweenHtmlNodes(htmlAst);
  const htmlString = serialize(htmlAst);
  return htmlString;
};

const ensureLineBreaksBetweenHtmlNodes = (rootNode) => {
  const mutations = [];

  const documentType = rootNode.childNodes[0];
  if (documentType.nodeName === "#documentType") {
    const html = rootNode.childNodes[1];
    if (html.nodeName === "html") {
      mutations.push(() => {
        insertHtmlNodeAfter({ nodeName: "#text", value: "\n" }, documentType);
      });

      const head = html.childNodes[0];
      if (head.nodeName === "head") {
        mutations.push(() => {
          insertHtmlNodeBefore({ nodeName: "#text", value: "\n  " }, head);
        });
      }

      const body = html.childNodes.find((node) => node.nodeName === "body");
      if (body) {
        const bodyLastChild = body.childNodes[body.childNodes.length - 1];
        if (bodyLastChild.nodeName !== "#text") {
          mutations.push(() => {
            insertHtmlNodeAfter(
              { nodeName: "#text", value: "\n  " },
              bodyLastChild,
            );
          });
        }
        if (
          bodyLastChild.nodeName === "#text" &&
          bodyLastChild.value[bodyLastChild.value.length - 1] === "\n"
        ) {
          bodyLastChild.value = bodyLastChild.value.slice(0, -1);
        }
      }

      const htmlLastChild = html.childNodes[html.childNodes.length - 1];
      if (htmlLastChild.nodeName !== "#text") {
        mutations.push(() => {
          insertHtmlNodeAfter(
            { nodeName: "#text", value: "\n" },
            htmlLastChild,
          );
        });
      }
    }
  }

  mutations.forEach((m) => m());
};

export const parseSvgString = (svgString) => {
  const svgAst = parseFragment(svgString, {
    sourceCodeLocationInfo: true,
  });
  return svgAst;
};
export const stringifySvgAst = stringifyHtmlAst;
