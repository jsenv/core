import { findHtmlNode, getHtmlNodeText } from "@jsenv/ast";
import { readDirectorySync, readEntryStatSync } from "@jsenv/filesystem";
import { urlToFilename, urlToRelativeUrl } from "@jsenv/urls";
import anchor from "anchor-markdown-header";
import { mdAsHtml } from "./md_as_html.js";
import { getEntryMarkdownFile } from "./resolve_md_entry_file.js";

const PREVIOUS_CHAR = "&lt;"; // "<"
const NEXT_CHAR = "&gt;"; // ">"

export const replacePlaceholders = (string, replacers) => {
  string = string.replace(/\$\{(\w+)\}/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    let replacement = typeof replacer === "function" ? replacer() : replacer;
    return generateReplacement(replacement, name);
  });
  string = string.replace(
    /<!-- PLACEHOLDER_START:(\w+) -->[\s\S]*?<!-- PLACEHOLDER_END -->/g,
    (match, name) => {
      const replacer = replacers[name];
      if (replacer === undefined) {
        return match;
      }
      let replacement = typeof replacer === "function" ? replacer() : replacer;
      return generateReplacement(replacement, name);
    },
  );
  return string;
};

export const generateTableOfContents = (markdownFile) => {
  const tableOfContentRootNode = {
    title: "Table of contents",
    canCollapse: true,
    defaultOpen: false,
    children: [],
  };
  const htmlTree = mdAsHtml(markdownFile.content);
  let isFirstH1 = true;
  const htmlNode = htmlTree.childNodes.find((node) => node.nodeName === "html");
  const body = htmlNode.childNodes.find((node) => node.nodeName === "body");
  let currentHeadingLink = null;
  for (const child of body.childNodes) {
    if (child.nodeName === "h1") {
      const text = getHtmlNodeText(child);
      if (isFirstH1) {
        isFirstH1 = false;
        // tableOfContentRootNode.title = text;
        // continue;
      }
      currentHeadingLink = {
        level: 1,
        text,
        href: new URL(markdownHrefFromText(text), markdownFile.url),
        children: [],
      };
      tableOfContentRootNode.children.push(currentHeadingLink);
      continue;
    }
    if (child.nodeName === "h2") {
      if (!currentHeadingLink || currentHeadingLink.level !== 1) {
        continue;
      }
      const text = getHtmlNodeText(child);
      currentHeadingLink.children.push({
        level: 2,
        text,
        href: new URL(markdownHrefFromText(text), markdownFile.url),
      });
    }
    continue;
  }
  // find all stuff and make a table
  return renderTableOfContentsMarkdown(
    tableOfContentRootNode,
    markdownFile.url,
  );
};
const markdownHrefFromText = (text) => {
  const markdownLink = anchor(text);
  const hrefStartIndex = markdownLink.indexOf("(#");
  const hrefPart = markdownLink.slice(hrefStartIndex + 1, -1);
  return hrefPart;
};

export const generateDirectoryTableOfContents = (
  markdownFile,
  directoryContent,
  directoryUrl,
) => {
  const tableOfContentRootNode = {
    title: "Table of contents",
    children: [],
  };
  for (const entryName of directoryContent) {
    const entryUrl = new URL(entryName, directoryUrl);
    const entryStat = readEntryStatSync(entryUrl);
    if (!entryStat.isDirectory()) {
      continue;
    }
    entryUrl.pathname += "/";
    const subDirectoryContent = readDirectorySync(entryUrl);
    const mainMarkdownFile = getEntryMarkdownFile(
      entryUrl,
      subDirectoryContent,
    );
    if (!mainMarkdownFile) {
      continue;
    }
    const title = extractMarkdownFileTitle(mainMarkdownFile);
    tableOfContentRootNode.children.push({
      href: mainMarkdownFile.url,
      text: title,
    });
  }
  return renderTableOfContentsMarkdown(
    tableOfContentRootNode,
    markdownFile.url,
  );
};
const renderTableOfContentsMarkdown = (rootNode, markdownFileUrl) => {
  let tableOfContent = "";
  let indent = 0;
  if (rootNode.canCollapse) {
    tableOfContent += `<details${rootNode.defaultOpen ? " open" : ""}>
  <summary>${rootNode.title}</summary>`;
    indent = 1;
  }
  const visit = (node, indent) => {
    if (tableOfContent) tableOfContent += "\n";
    tableOfContent += `${"  ".repeat(indent)}<ul>`;
    for (const childNode of node.children) {
      tableOfContent += `\n${"  ".repeat(indent + 1)}<li>`;
      tableOfContent += `\n${"  ".repeat(indent + 2)}<a href="${urlToRelativeUrl(childNode.href, markdownFileUrl)}">
${"  ".repeat(indent + 3)}${escapeHtml(childNode.text)}
${"  ".repeat(indent + 2)}</a>`;
      if (childNode.children?.length) {
        visit(childNode, indent + 3);
      }
      tableOfContent += `\n${"  ".repeat(indent + 1)}</li>`;
    }
    tableOfContent += `\n${"  ".repeat(indent)}</ul>`;
  };
  visit(rootNode, indent);
  if (rootNode.canCollapse) {
    tableOfContent += `\n</details>`;
  }
  return tableOfContent;
};

export const generatePrevNextNav = (
  markdownFile,
  prevDirectoryUrl,
  nextDirectoryUrl,
) => {
  // get previous url
  const prevMarkdownFile = prevDirectoryUrl
    ? getEntryMarkdownFile(prevDirectoryUrl)
    : null;
  const nextMarkdownFile = nextDirectoryUrl
    ? getEntryMarkdownFile(nextDirectoryUrl)
    : null;

  // single
  if (!prevMarkdownFile && !nextMarkdownFile) {
    return "";
  }
  // first
  if (!prevMarkdownFile && nextMarkdownFile) {
    const currentTitle = extractMarkdownFileTitle(markdownFile);
    const nextTitle = extractMarkdownFileTitle(nextMarkdownFile);
    const nextUrlRelativeToCurrent = urlToRelativeUrl(
      nextMarkdownFile.url,
      markdownFile.url,
    );
    return `<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      ${escapeHtml(currentTitle)}
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="${nextUrlRelativeToCurrent}">${NEXT_CHAR} ${escapeHtml(nextTitle)}</a>
    </td>
  </tr>
</table>`;
  }
  // last
  if (prevMarkdownFile && !nextMarkdownFile) {
    const currentTitle = extractMarkdownFileTitle(markdownFile);
    const prevTitle = extractMarkdownFileTitle(prevMarkdownFile);
    const prevUrlRelativeToCurrent = urlToRelativeUrl(
      prevMarkdownFile.url,
      markdownFile.url,
    );
    return `<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="${prevUrlRelativeToCurrent}">${PREVIOUS_CHAR} ${escapeHtml(prevTitle)}</a>
    </td>
    <td width="2000px" align="right" nowrap>
      ${escapeHtml(currentTitle)}
    </td>
  </tr>
<table></table>`;
  }
  // between
  const currentTitle = extractMarkdownFileTitle(markdownFile);
  const prevTitle = extractMarkdownFileTitle(prevMarkdownFile);
  const prevUrlRelativeToCurrent = urlToRelativeUrl(
    prevMarkdownFile.url,
    markdownFile.url,
  );
  const nextTitle = extractMarkdownFileTitle(nextMarkdownFile);
  const nextUrlRelativeToCurrent = urlToRelativeUrl(
    nextMarkdownFile.url,
    markdownFile.url,
  );
  return `<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="${prevUrlRelativeToCurrent}">${PREVIOUS_CHAR} ${escapeHtml(prevTitle)}</a>
    </td>
    <td width="2000px" align="center" nowrap>
      ${escapeHtml(currentTitle)}
    </td>
    <td width="2000px" align="right" nowrap>
      <a href="${nextUrlRelativeToCurrent}">${NEXT_CHAR} ${escapeHtml(nextTitle)}</a>
    </td>
  </tr>
<table>`;
};
const extractMarkdownFileTitle = (markdownFile) => {
  const htmlTree = mdAsHtml(markdownFile.content);
  let title;
  findHtmlNode(htmlTree, (node) => {
    if (node.nodeName === "#comment") {
      const data = node.data;
      const match = data.match(/ TITLE: (.+) /);
      if (match) {
        title = match[1];
        return true;
      }
    }
    if (node.nodeName === "h1") {
      title = getHtmlNodeText(node);
      return true;
    }
    return false;
  });
  return title || urlToFilename(markdownFile.url);
};
const generateReplacement = (value, placeholder) => {
  let replacementWithMarkers = `<!-- PLACEHOLDER_START:${placeholder} -->

${value}

<!-- PLACEHOLDER_END -->`;
  return replacementWithMarkers;
};

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};
