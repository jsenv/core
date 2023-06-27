import { jsenvPluginReferenceExpectedTypes } from "./jsenv_plugin_reference_expected_types.js";
import { jsenvPluginDirectoryReferenceAnalysis } from "./directory/jsenv_plugin_directory_reference_analysis.js";
import { jsenvPluginDataUrlsAnalysis } from "./data_urls/jsenv_plugin_data_urls_analysis.js";
import { jsenvPluginHtmlReferenceAnalysis } from "./html/jsenv_plugin_html_reference_analysis.js";
import { jsenvPluginWebmanifestReferenceAnalysis } from "./webmanifest/jsenv_plugin_webmanifest_reference_analysis.js";
import { jsenvPluginCssReferenceAnalysis } from "./css/jsenv_plugin_css_reference_analysis.js";
import { jsenvPluginJsReferenceAnalysis } from "./js/jsenv_plugin_js_reference_analysis.js";

export const jsenvPluginReferenceAnalysis = ({
  inlineContent = true,
  inlineConvertedScript = false,
  fetchInlineUrls = true,
  allowEscapeForVersioning = false,
}) => {
  return [
    jsenvPluginDirectoryReferenceAnalysis(),
    jsenvPluginHtmlReferenceAnalysis({
      inlineContent,
      inlineConvertedScript,
    }),
    jsenvPluginWebmanifestReferenceAnalysis(),
    jsenvPluginCssReferenceAnalysis(),
    jsenvPluginJsReferenceAnalysis({
      inlineContent,
      allowEscapeForVersioning,
    }),
    ...(inlineContent ? [jsenvPluginDataUrlsAnalysis()] : []),
    ...(inlineContent && fetchInlineUrls
      ? [jsenvPluginInlineContentFetcher()]
      : []),
    jsenvPluginReferenceExpectedTypes(),
  ];
};

const jsenvPluginInlineContentFetcher = () => {
  return {
    name: "jsenv:inline_content_fetcher",
    appliesDuring: "*",
    fetchUrlContent: (urlInfo, context) => {
      if (!urlInfo.isInline) {
        return null;
      }
      const { firstReference } = urlInfo;
      return {
        // we want to fetch the original content otherwise we might re-cook
        // content already cooked
        originalContent: context.build
          ? urlInfo.originalContent === undefined
            ? firstReference.content
            : urlInfo.originalContent
          : firstReference.content,
        content: firstReference.content,
        contentType: firstReference.contentType,
      };
    },
  };
};
