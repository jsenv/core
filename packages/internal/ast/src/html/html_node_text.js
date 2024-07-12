import {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html_node_attributes.js";

export const getHtmlNodeText = (htmlNode) => {
  const textNode = getTextNode(htmlNode);
  return textNode ? textNode.value : undefined;
};

const getTextNode = (htmlNode) => {
  if (htmlNode.nodeName === "#text") {
    return null;
  }
  const firstChild = htmlNode.childNodes[0];
  const textNode =
    firstChild && firstChild.nodeName === "#text" ? firstChild : null;
  return textNode;
};

export const removeHtmlNodeText = (htmlNode) => {
  const textNode = getTextNode(htmlNode);
  if (textNode) {
    htmlNode.childNodes = [];
  }
};

export const setHtmlNodeText = (
  htmlNode,
  textContent,
  { indentation } = {},
) => {
  if (indentation === "auto") {
    const contentIndentedAttribute = getHtmlNodeAttribute(
      htmlNode,
      "content-indented",
    );
    if (contentIndentedAttribute === undefined) {
      const indentation = getIndentation(htmlNode);
      textContent = setIndentation(textContent, indentation);
      setHtmlNodeAttributes(htmlNode, {
        "content-indented": "",
      });
    }
  }
  const textNode = getTextNode(htmlNode);
  if (textNode) {
    textNode.value = textContent;
  } else {
    const newTextNode = {
      nodeName: "#text",
      value: textContent,
      parentNode: htmlNode,
    };
    htmlNode.childNodes.splice(0, 0, newTextNode);
  }
};

export const getIndentation = (htmlNode) => {
  const parentNode = htmlNode.parentNode;
  if (!parentNode) {
    return "";
  }

  const siblings = parentNode.childNodes;
  const index = siblings.indexOf(htmlNode);
  if (index === 0) {
    if (htmlNode.nodeName === "#text") {
      return extractIndentation(htmlNode);
    }
    return "";
  }

  let textNodeIndex = 0;
  let textNode;
  while (textNodeIndex !== index) {
    const previousSibling = siblings[textNodeIndex];
    textNodeIndex++;
    if (previousSibling.nodeName === "#text") {
      textNode = previousSibling;
      break;
    }
  }
  if (!textNode) {
    return "";
  }

  return extractIndentation(textNode);
};

const extractIndentation = (textNode) => {
  const text = textNode.value;
  const lines = text.split(/\r?\n/);
  const lastLine = lines[lines.length - 1];
  if (lastLine.match(/^[\t ]+$/)) {
    return lastLine;
  }
  return "";
};

const setIndentation = (htmlNodeText, indentation) => {
  const contentIdentation = increaseIndentation(indentation, 2);
  const lines = htmlNodeText.trimEnd().split(/\r?\n/);
  let result = `\n`;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    i++;
    result += `${contentIdentation}${line}\n`;
  }
  result += `${indentation}`;
  return result;
};

export const increaseIndentation = (indentation, size) => {
  const char = indentation[0];
  return char ? `${indentation}${char.repeat(size)}` : " ".repeat(size);
};

export const decreaseIndentation = (indentation, size) => {
  const char = indentation[0];
  if (char) {
    return char.slice(0, -size);
  }
  return "";
};
