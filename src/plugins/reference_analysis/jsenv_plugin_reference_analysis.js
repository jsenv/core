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
  directoryReferenceEffect,
}) => {
  return [
    jsenvPluginDirectoryReferenceAnalysis({
      directoryReferenceEffect,
    }),
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
      // - we must use last reference because
      //   when updating the file, first reference is the previous version
      // - we cannot use urlInfo.lastReference because it can be the reference created by "http_request"
      let lastInlineReference;
      let originalContent = urlInfo.originalContent;
      for (const reference of urlInfo.referenceFromOthersSet) {
        if (reference.isInline) {
          if (urlInfo.originalContent === undefined) {
            originalContent = reference.content;
          }
          lastInlineReference = reference;
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
        }
      }
      return {
        originalContent,
        content:
          // we must favor original content to re-apply the same plugin logic
          // so that the same references are generated
          // without this we would try to resolve references like
          // "/node_modules/package/file.js" instead of "package/file.js"
          // meaning we would not create the implicit dependency to package.json
          // resulting in a reload of the browser (as implicit reference to package.json is gone)
          originalContent === undefined
            ? lastInlineReference.content
            : originalContent,
        contentType: lastInlineReference.contentType,
      };
    },
  };
};
