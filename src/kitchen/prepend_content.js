// TODO: reuse to inject versioning

import { createMagicSource, composeTwoSourcemaps } from "@jsenv/sourcemap";
import {
  parseHtmlString,
  stringifyHtmlAst,
  createHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
} from "@jsenv/ast";

// we must (both during dev and build)
// cook the files that will be put as banner code
// however these files are quite special because
// - they are implicitely referenced
// ideally I should create an implicit reference for these files
// but I don't know yet how to proceed
// je pense comme ceci:
// durant le dev, pas le choix on doit cook le fichier
// (genre on cook s.js pendant qu'on cook a.js)
// pour le build le cook se produira indirectement
// par url graph loader ce qui fera en sorte qu'on ait
// les urls infos correspondantes a la fin
// on va donc commencer par le dev
// puis le build et s'assurer que tout ça fonctionne

export const prependContent = (urlInfo, bannerUrlInfo) => {
  if (urlInfo.type === "html") {
    return prependContentInHtml(urlInfo, bannerUrlInfo);
  }
  if (urlInfo.type === "js_module" || urlInfo.type === "js_classic") {
    return prependContentInJs(urlInfo, bannerUrlInfo);
  }
  // ideally we could for css as well
  // otherwise throw an error
  return null;
};

const prependContentInHtml = (urlInfo, bannerUrlInfo) => {
  const htmlAst = parseHtmlString(urlInfo.content);
  injectHtmlNodeAsEarlyAsPossible(
    htmlAst,
    createHtmlNode({
      tagName: "script",
      textContent: bannerUrlInfo.content,
    }),
    "jsenv:core",
  );
  return {
    content: stringifyHtmlAst(htmlAst),
  };
};

const prependContentInJs = (urlInfo, bannerUrlInfo) => {
  const magicSource = createMagicSource(urlInfo.content);
  magicSource.prepend(`${bannerUrlInfo.content}\n\n`);
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
