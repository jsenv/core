import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";
import { URL_META } from "@jsenv/url-meta";
import { asUrlWithoutSearch } from "@jsenv/urls";

export const jsenvPluginRibbon = ({
  rootDirectoryUrl,
  htmlInclude = "/**/*.html",
  text,
  color,
  textColor,
  href,
  target,
  position,
}) => {
  const ribbonClientFileUrl = import.meta.resolve("./client/ribbon.js");
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
    appliesDuring: "*",
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
          specifier: ribbonClientFileUrl,
        });
        injectJsenvScript(htmlAst, {
          type: "module",
          src: ribbonClientFileReference.generatedSpecifier,
          initCall: {
            callee: "injectRibbon",
            params: withoutUndefinedValues({
              text:
                text === undefined
                  ? urlInfo.context.dev
                    ? "DEV"
                    : "BUILD"
                  : text,
              color,
              textColor,
              href,
              target,
              position,
            }),
          },
          pluginName: "jsenv:ribbon",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
  };
};

const withoutUndefinedValues = (object) => {
  const objectWithoutUndefinedValues = {};
  for (const key of Object.keys(object)) {
    if (object[key] !== undefined) {
      objectWithoutUndefinedValues[key] = object[key];
    }
  }
  return objectWithoutUndefinedValues;
};
