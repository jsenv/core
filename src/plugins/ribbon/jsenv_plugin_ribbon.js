import { parseHtml, stringifyHtmlAst, injectJsenvScript } from "@jsenv/ast";
import { URL_META } from "@jsenv/url-meta";
import { asUrlWithoutSearch } from "@jsenv/urls";

export const jsenvPluginRibbon = ({
  rootDirectoryUrl,
  htmlInclude = "/**/*.html",
}) => {
  const ribbonClientFileUrl = new URL("./client/ribbon.js", import.meta.url);
  const associations = URL_META.resolveAssociations(
    {
      ribbon: {
        [htmlInclude]: true,
      },
    },
    rootDirectoryUrl,
  );
  return {
    name: "jsenv:ribbon",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        const jsenvToolbarHtmlClientFileUrl = urlInfo.context.getPluginMeta(
          "jsenvToolbarHtmlClientFileUrl",
        );
        if (
          jsenvToolbarHtmlClientFileUrl &&
          // startsWith to ignore search params
          urlInfo.url.startsWith(jsenvToolbarHtmlClientFileUrl)
        ) {
          return null;
        }
        const { ribbon } = URL_META.applyAssociations({
          url: asUrlWithoutSearch(urlInfo.url),
          associations,
        });
        if (!ribbon) {
          return null;
        }
        const htmlAst = parseHtml({
          html: urlInfo.content,
          url: urlInfo.url,
        });
        const ribbonClientFileReference = urlInfo.dependencies.inject({
          type: "script",
          subtype: "js_module",
          expectedType: "js_module",
          specifier: ribbonClientFileUrl.href,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: ribbonClientFileReference.generatedSpecifier,
          initCall: {
            callee: "injectRibbon",
            params: {
              text: urlInfo.context.dev ? "DEV" : "BUILD",
            },
          },
          pluginName: "jsenv:ribbon",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};
