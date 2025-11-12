import { jsenvPluginCssReferenceAnalysis } from "./css/jsenv_plugin_css_reference_analysis.js";
import { jsenvPluginDataUrlsAnalysis } from "./data_urls/jsenv_plugin_data_urls_analysis.js";
import { jsenvPluginDirectoryReferenceAnalysis } from "./directory/jsenv_plugin_directory_reference_analysis.js";
import { jsenvPluginHtmlReferenceAnalysis } from "./html/jsenv_plugin_html_reference_analysis.js";
import { jsenvPluginJsReferenceAnalysis } from "./js/jsenv_plugin_js_reference_analysis.js";
import { jsenvPluginReferenceExpectedTypes } from "./jsenv_plugin_reference_expected_types.js";
import { jsenvPluginWebmanifestReferenceAnalysis } from "./webmanifest/jsenv_plugin_webmanifest_reference_analysis.js";

export const jsenvPluginReferenceAnalysis = ({
  inlineContent = true,
  inlineConvertedScript = false,
  fetchInlineUrls = true,
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
    fetchUrlContent: async (urlInfo) => {
      if (!urlInfo.isInline) {
        return null;
      }
      const isDirectRequest = urlInfo.context.requestedUrl === urlInfo.url;
      /*
       * We want to find inline content but it's not straightforward
       *
       * For some reason (that would be great to investigate)
       * urlInfo corresponding to inline content has several referenceFromOthersSet
       * so the latest version is the last reference
       * BUT the last reference is the "http_request"
       * so it's more likely the before last reference that contains the latest version
       *
       * BUT there is an exception when using supervisor as the before last reference
       * is the one fetched by the browser that is already cooked
       * we must re-cook from the original content, not from the already cooked content
       * Otherwise references are already resolved and
       * - "/node_modules/package/file.js" instead of "package/file.js"
       * - meaning we would not create the implicit dependency to package.json
       * - resulting in a reload of the browser (as implicit reference to package.json is gone)
       * -> can create infinite loop of reloads
       */
      let lastInlineReference;
      let originalContent = urlInfo.originalContent;
      for (const reference of urlInfo.referenceFromOthersSet) {
        if (!reference.isInline) {
          continue;
        }
        if (urlInfo.originalContent === undefined) {
          originalContent = reference.content;
        }
        lastInlineReference = reference;
        if (isDirectRequest) {
          break;
        }
      }
      const { prev } = lastInlineReference;
      if (prev && !prev.isInline) {
        // got inlined, cook original url
        if (lastInlineReference.content === undefined) {
          const originalUrlInfo = prev.urlInfo;
          await originalUrlInfo.cook();
          originalContent = originalUrlInfo.originalContent;
          lastInlineReference.content = originalUrlInfo.content;
          lastInlineReference.contentType = originalUrlInfo.contentType;
          return {
            originalContent: originalUrlInfo.originalContent,
            content: originalUrlInfo.content,
            contentType: originalUrlInfo.contentType,
          };
        }
      }
      return {
        originalContent,
        content:
          originalContent === undefined
            ? lastInlineReference.content
            : originalContent,
        contentType: lastInlineReference.contentType,
      };
    },
  };
};
