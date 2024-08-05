import { generateContentFrame } from "@jsenv/humanize";
import { parse, parseFragment, serialize } from "parse5";
import { createParseError } from "../parse_error.js";
import { insertHtmlNodeAfter, insertHtmlNodeBefore } from "./html_node.js";
import {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html_node_attributes.js";
import {
  storeHtmlNodeAttributePosition,
  storeHtmlNodePosition,
} from "./html_node_position.js";
import { getHtmlNodeText } from "./html_node_text.js";
import { findHtmlChildNode, visitHtmlNodes } from "./html_search.js";

export const parseHtml = ({ html, url, storeOriginalPositions = true }) => {
  const htmlAst = parse(html, {
    sourceCodeLocationInfo: true,
    onParseError: (parse5Error) => {
      if (
        [
          "missing-doctype",
          "abandoned-head-element-child",
          "duplicate-attribute",
          "non-void-html-element-start-tag-with-trailing-solidus",
        ].includes(parse5Error.code)
      ) {
        return;
      }
      const htmlParseError = createParseError(
        `Unable to parse HTML; ${parse5Error.code}`,
        {
          reasonCode: parse5Error.code,
          url,
          line: parse5Error.startLine,
          column: parse5Error.startCol,
          contentFrame: generateContentFrame({
            content: html,
            line: parse5Error.startLine,
            column: parse5Error.startCol,
          }),
        },
      );
      throw htmlParseError;
    },
  });
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
  {
    preserveLineBreaks = true,
    cleanupJsenvAttributes = false,
    cleanupPositionAttributes = false,
  } = {},
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
  if (preserveLineBreaks) {
    // ensure body and html have \n
    ensureLineBreaksBetweenHtmlNodes(htmlAst);
  }
  const htmlString = serialize(htmlAst);
  return htmlString;
};

const ensureLineBreaksBetweenHtmlNodes = (rootNode) => {
  const mutationCallbackSet = new Set();
  const documentType = rootNode.childNodes[0];
  const ensureChildrenSurroundedByLinebreaks = (headOrBody) => {
    const { childNodes } = headOrBody;
    const firstChild = childNodes[0];
    if (firstChild.nodeName !== "#text") {
      mutationCallbackSet.add(() => {
        insertHtmlNodeBefore(
          { nodeName: "#text", value: "\n    " },
          firstChild,
        );
      });
    }
    const lastChild = childNodes[childNodes.length - 1];
    if (lastChild.nodeName === "#text") {
      if (headOrBody.nodeName === "head" && lastChild.value === "\n    ") {
        lastChild.value = "\n  ";
      }
    } else {
      mutationCallbackSet.add(() => {
        insertHtmlNodeAfter({ nodeName: "#text", value: "\n  " }, lastChild);
      });
    }
    if (
      lastChild.nodeName === "#text" &&
      lastChild.value[lastChild.value.length - 1] === "\n"
    ) {
      lastChild.value = lastChild.value.slice(0, -1);
    }
  };

  if (documentType.nodeName === "#documentType") {
    const html = rootNode.childNodes[1];
    if (html.nodeName === "html") {
      mutationCallbackSet.add(() => {
        insertHtmlNodeAfter({ nodeName: "#text", value: "\n" }, documentType);
      });
      const htmlChildNodes = html.childNodes;
      const head = htmlChildNodes.find((node) => node.nodeName === "head");
      if (head) {
        mutationCallbackSet.add(() => {
          insertHtmlNodeBefore({ nodeName: "#text", value: "\n  " }, head);
        });
        ensureChildrenSurroundedByLinebreaks(head);
      }
      const body = htmlChildNodes.find((node) => node.nodeName === "body");
      if (body) {
        const nodeBeforeBody = htmlChildNodes[htmlChildNodes.indexOf(body) - 1];
        if (nodeBeforeBody && nodeBeforeBody.nodeName !== "#text") {
          mutationCallbackSet.add(() => {
            insertHtmlNodeBefore({ nodeName: "#text", value: "\n  " }, body);
          });
        }
        ensureChildrenSurroundedByLinebreaks(body);
      }
      const htmlLastChild = html.childNodes[html.childNodes.length - 1];
      if (htmlLastChild.nodeName !== "#text") {
        mutationCallbackSet.add(() => {
          insertHtmlNodeAfter(
            { nodeName: "#text", value: "\n" },
            htmlLastChild,
          );
        });
      }
    }
  }
  for (const mutationCallback of mutationCallbackSet) {
    mutationCallback();
  }
};

export const parseSvgString = (svgString) => {
  const svgAst = parseFragment(svgString, {
    sourceCodeLocationInfo: true,
  });
  return svgAst;
};
export const stringifySvgAst = stringifyHtmlAst;
