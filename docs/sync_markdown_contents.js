import { findHtmlNode, getHtmlNodeText, parseHtml } from "@jsenv/ast";
import {
  readDirectorySync,
  readEntryStatSync,
  readFileSync,
  writeFileSync,
} from "@jsenv/filesystem";
import { urlToFilename, urlToRelativeUrl } from "@jsenv/urls";
import { marked } from "marked";

const PREVIOUS_CHAR = "&lt;"; // "<"
const NEXT_CHAR = "&gt;"; // ">"

const syncMarkdownInDirectory = (
  directoryUrl,
  previousDirectoryUrl,
  nextDirectoryUrl,
) => {
  const directoryContent = readDirectorySync(directoryUrl);
  const markdownFile = getMainMarkdownFile(directoryUrl);
  if (!markdownFile) {
    return;
  }
  syncMarkdownContent(markdownFile, {
    DIRECTORY_TABLE_OF_CONTENT: () => {
      return generateTableOfContents(directoryContent, directoryUrl);
    },
    PREV_NEXT_NAV: () => {
      return generatePrevNextNav(
        markdownFile.url,
        previousDirectoryUrl,
        nextDirectoryUrl,
      );
    },
  });
  const directoryUrls = [];
  for (const entryName of directoryContent) {
    const entryUrl = new URL(entryName, directoryUrl);
    const statsSync = readEntryStatSync(entryUrl);
    if (statsSync.isDirectory()) {
      entryUrl.pathname += "/";
      directoryUrls.push(entryUrl);
    } else {
      // it's safe to break because directory comes first
      break;
    }
  }
  let i = 0;
  while (i < directoryUrls.length) {
    const directoryUrl = directoryUrls[i];
    syncMarkdownInDirectory(
      directoryUrl,
      directoryUrls[i - 1],
      directoryUrls[i + 1],
    );
    i++;
  }
};
const getMainMarkdownFile = (directoryUrl) => {
  const directoryName = urlToFilename(directoryUrl);
  const markdownFileUrl = new URL(`./${directoryName}.md`, directoryUrl);
  try {
    const markdownFileContent = String(readFileSync(markdownFileUrl));
    return {
      url: markdownFileUrl,
      content: markdownFileContent,
    };
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return null;
    }
    throw e;
  }
};
const syncMarkdownContent = (markdownFile, replacers) => {
  const mardownFileContent = markdownFile.content;
  const markdownFileContentReplaced = replacePlaceholders(
    mardownFileContent,
    replacers,
  );
  writeFileSync(markdownFile.url, markdownFileContentReplaced);
};
const generateTableOfContents = (directoryContent, directoryUrl) => {
  let tableOfContent = "";
  for (const entryName of directoryContent) {
    const entryUrl = new URL(entryName, directoryUrl);
    const entryStat = readEntryStatSync(entryUrl);
    if (!entryStat.isDirectory()) {
      continue;
    }
    entryUrl.pathname += "/";
    const subDirectoryContent = readDirectorySync(entryUrl);
    const mainMarkdownFile = getMainMarkdownFile(entryUrl, subDirectoryContent);
    if (!mainMarkdownFile) {
      continue;
    }
    const title = extractMarkdownFileTitle(mainMarkdownFile);
    if (tableOfContent) {
      tableOfContent += "<br />\n";
    }
    tableOfContent += `<a href="./${urlToRelativeUrl(mainMarkdownFile.url, directoryUrl)}">${escapeHtml(title)}</a>`;
  }
  return tableOfContent;
};
const generatePrevNextNav = (url, prevDirectoryUrl, nextDirectoryUrl) => {
  // get previous url
  const prevMarkdownFile = prevDirectoryUrl
    ? getMainMarkdownFile(prevDirectoryUrl)
    : null;
  const nextMarkdownFile = nextDirectoryUrl
    ? getMainMarkdownFile(nextDirectoryUrl)
    : null;

  // single
  if (!prevMarkdownFile && !nextMarkdownFile) {
    return "";
  }
  // first
  if (!prevMarkdownFile && nextMarkdownFile) {
    const nextTitle = extractMarkdownFileTitle(nextMarkdownFile);
    const nextUrlRelativeToCurrent = urlToRelativeUrl(
      nextMarkdownFile.url,
      url,
    );
    return `<table>
  <tr>
    <td width="2000px" align="right" nowrap>
      <a href="${nextUrlRelativeToCurrent}">${NEXT_CHAR} ${escapeHtml(nextTitle)}</a>
    </td>
  </tr>
</table>`;
  }
  // last
  if (prevMarkdownFile && !nextMarkdownFile) {
    const prevTitle = extractMarkdownFileTitle(prevMarkdownFile);
    const prevUrlRelativeToCurrent = urlToRelativeUrl(
      prevMarkdownFile.url,
      url,
    );
    return `<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="${prevUrlRelativeToCurrent}">${PREVIOUS_CHAR} ${escapeHtml(prevTitle)}</a>
  </td>
 </tr>
<table></table>`;
  }
  // between
  const prevTitle = extractMarkdownFileTitle(prevMarkdownFile);
  const prevUrlRelativeToCurrent = urlToRelativeUrl(prevMarkdownFile.url, url);
  const nextTitle = extractMarkdownFileTitle(nextMarkdownFile);
  const nextUrlRelativeToCurrent = urlToRelativeUrl(nextMarkdownFile.url, url);
  return `<table>
 <tr>
  <td width="2000px" align="left" nowrap>
   <a href="${prevUrlRelativeToCurrent}">${PREVIOUS_CHAR} ${escapeHtml(prevTitle)}</a>
  </td>
  <td width="2000px" align="right" nowrap>
   <a href="${nextUrlRelativeToCurrent}">${NEXT_CHAR} ${escapeHtml(nextTitle)}</a>
  </td>
 </tr>
<table>`;
};
const extractMarkdownFileTitle = (markdownFile) => {
  const mdAsHtml = marked.parse(markdownFile.content);
  const htmlTree = parseHtml({ html: mdAsHtml });
  const h1 = findHtmlNode(htmlTree, (node) => node.nodeName === "h1");
  const title = h1 ? getHtmlNodeText(h1) : urlToFilename(markdownFile.url);
  return title;
};
const generateReplacement = (value, placeholder) => {
  let replacementWithMarkers = `<!-- PLACEHOLDER_START:${placeholder} -->

${value}

<!-- PLACEHOLDER_END -->`;
  return replacementWithMarkers;
};
const replacePlaceholders = (string, replacers) => {
  string = string.replace(/\$\{(\w+)\}/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    let replacement = typeof replacer === "function" ? replacer() : replacer;
    return generateReplacement(replacement, name);
  });
  string = string.replace(
    /<!-- PLACEHOLDER_START:(\w+) -->[\s\S]*<!-- PLACEHOLDER_END -->/g,
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
const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

syncMarkdownInDirectory(new URL("./users/", import.meta.url));
