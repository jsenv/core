import {
  readDirectorySync,
  readEntryStatSync,
  writeFileSync,
} from "@jsenv/filesystem";
import { lintMarkdown } from "./lint_markdown.js";
import {
  generateDirectoryTableOfContents,
  generatePrevNextNav,
  generateTableOfContents,
  replacePlaceholders,
} from "./replace_md_content.js";
import {
  createMarkdownFile,
  getEntryMarkdownFile,
} from "./resolve_md_entry_file.js";

export const syncMarkdown = (markdownFileUrl, { tocMode = "summary" } = {}) => {
  const markdownFile = createMarkdownFile(markdownFileUrl);
  if (!markdownFile) {
    return;
  }
  const directoryUrl = new URL("./", markdownFileUrl);
  syncMarkdownFile(markdownFile, { directoryUrl, tocMode });
};

const syncMarkdownFile = (
  markdownFile,
  { directoryUrl, prevDirectoryUrl, nextDirectoryUrl, tocMode },
) => {
  const directoryContent = readDirectorySync(directoryUrl);
  syncMarkdownContent(markdownFile, {
    TOC_INLINE: () => {
      return generateTableOfContents(markdownFile, { tocMode: "inline" });
    },
    TOC: () => {
      return generateTableOfContents(markdownFile, { tocMode });
    },
    TOC_DIRECTORY: () => {
      return generateDirectoryTableOfContents(
        markdownFile,
        directoryContent,
        directoryUrl,
        { tocMode },
      );
    },
    NAV_PREV_NEXT: () => {
      return generatePrevNextNav(
        markdownFile,
        prevDirectoryUrl,
        nextDirectoryUrl,
      );
    },
  });
  const directoryUrls = [];
  for (const entryName of directoryContent) {
    const entryUrl = new URL(entryName, directoryUrl);
    const statsSync = readEntryStatSync(entryUrl);
    if (!statsSync.isDirectory()) {
      continue;
    }
    entryUrl.pathname += "/";
    directoryUrls.push(entryUrl);
  }
  let i = 0;
  while (i < directoryUrls.length) {
    const directoryUrl = directoryUrls[i];
    const directoryMarkdownFile = getEntryMarkdownFile(directoryUrl);
    if (directoryMarkdownFile) {
      syncMarkdownFile(directoryMarkdownFile, {
        directoryUrl,
        prevDirectoryUrl: directoryUrls[i - 1],
        nextDirectoryUrl: directoryUrls[i + 1],
        tocMode,
      });
    }
    i++;
  }
};
const syncMarkdownContent = (markdownFile, replacers) => {
  const mardownFileContent = markdownFile.content;
  const markdownFileContentReplaced = replacePlaceholders(
    mardownFileContent,
    replacers,
  );
  lintMarkdown(markdownFileContentReplaced, markdownFile.url);
  writeFileSync(markdownFile.url, markdownFileContentReplaced);
};
