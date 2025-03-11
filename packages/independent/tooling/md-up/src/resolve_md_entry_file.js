import { readFileSync } from "@jsenv/filesystem";
import { urlToFilename } from "@jsenv/urls";

export const getEntryMarkdownFile = (directoryUrl) => {
  readme: {
    const readmeMdFileUrl = new URL(`./readme.md`, directoryUrl);
    const readmeMdFile = createMarkdownFile(readmeMdFileUrl);
    if (readmeMdFile) {
      return readmeMdFile;
    }
  }
  dirname: {
    const directoryName = urlToFilename(directoryUrl);
    const dirMdFileUrl = new URL(`./${directoryName}.md`, directoryUrl);
    const dirMdFile = createMarkdownFile(dirMdFileUrl);
    if (dirMdFile) {
      return dirMdFile;
    }
    if (directoryName[0] === "_") {
      const dirWithoutLeadingUnderscoreUrl = new URL(
        `./${directoryName.slice(1)}.md`,
        directoryUrl,
      );
      const dirMdFile = createMarkdownFile(dirWithoutLeadingUnderscoreUrl);
      if (dirMdFile) {
        return dirMdFile;
      }
    }
  }
  return null;
};

export const createMarkdownFile = (markdownFileUrl) => {
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
