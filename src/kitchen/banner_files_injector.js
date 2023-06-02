import { readFileSync } from "node:fs";
import {
  createMagicSource,
  composeTwoSourcemaps,
  SOURCEMAP,
} from "@jsenv/sourcemap";
import { urlToRelativeUrl } from "@jsenv/urls";
import {
  parseHtmlString,
  stringifyHtmlAst,
  createHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
} from "@jsenv/ast";

export const injectBannerCodeFromFiles = (urlInfo, fileUrls) => {
  if (urlInfo.type === "html") {
    return injectFilesInHtml(urlInfo, fileUrls);
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return injectFilesInJs(urlInfo, fileUrls);
  }
  // ideally we could for css as well
  // otherwise throw an error
  return null;
};

const injectFilesInHtml = (urlInfo, fileUrls) => {
  const htmlAst = parseHtmlString(urlInfo.content);
  fileUrls.forEach((fileUrl) => {
    const fileContent = readFileContent(fileUrl, urlInfo);
    injectHtmlNodeAsEarlyAsPossible(
      htmlAst,
      createHtmlNode({
        tagName: "script",
        textContent: fileContent,
      }),
      "jsenv:core",
    );
  });
  return {
    content: stringifyHtmlAst(htmlAst),
  };
};

const injectFilesInJs = (urlInfo, fileUrls) => {
  const magicSource = createMagicSource(urlInfo.content);
  fileUrls.forEach((fileUrl) => {
    const fileContent = readFileContent(fileUrl, urlInfo);
    magicSource.prepend(`${fileContent}\n\n`);
  });
  const magicResult = magicSource.toContentAndSourcemap();
  const sourcemap = composeTwoSourcemaps(
    urlInfo.sourcemap,
    magicResult.sourcemap,
  );
  return {
    content: magicResult.content,
    sourcemap,
  };
};

const readFileContent = (fileUrl, urlInfo) => {
  let fileContent = readFileSync(new URL(fileUrl), "utf8");
  const sourcemapFound = SOURCEMAP.readComment({
    contentType: "text/javascript",
    content: fileContent,
  });
  if (sourcemapFound) {
    const sourcemapFileUrl = new URL(sourcemapFound.specifier, fileUrl);
    fileContent = SOURCEMAP.writeComment({
      contentType: "text/javascript",
      content: fileContent,
      specifier: urlToRelativeUrl(sourcemapFileUrl, urlInfo.url),
    });
  }
  return fileContent;
};
