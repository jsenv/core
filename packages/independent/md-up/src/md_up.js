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

export const syncMarkdown = (markdownFileUrl) => {
  const markdownFile = createMarkdownFile(markdownFileUrl);
  if (!markdownFile) {
    return;
  }
  const directoryUrl = new URL("./", markdownFileUrl);
  syncMarkdownFile(markdownFile, { directoryUrl });
};

const syncMarkdownFile = (
  markdownFile,
  { directoryUrl, prevDirectoryUrl, nextDirectoryUrl },
) => {
  const directoryContent = readDirectorySync(directoryUrl);
  syncMarkdownContent(markdownFile, {
    TOC: () => {
      return generateTableOfContents(markdownFile);
    },
    TOC_DIRECTORY: () => {
      return generateDirectoryTableOfContents(
        markdownFile,
        directoryContent,
        directoryUrl,
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
    const directoryMarkdownFile = getEntryMarkdownFile(directoryUrl);
    if (directoryMarkdownFile) {
      syncMarkdownFile(directoryMarkdownFile, {
        directoryUrl,
        prevDirectoryUrl: directoryUrls[i - 1],
        nextDirectoryUrl: directoryUrls[i + 1],
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
