import { jsenvPluginHtmlInlineContentAnalysis } from "./jsenv_plugin_html_inline_content_analysis.js";
import { jsenvPluginJsInlineContentAnalysis } from "./jsenv_plugin_js_inline_content_analysis.js";
import { jsenvPluginDataUrls } from "./jsenv_plugin_data_urls.js";

export const jsenvPluginInlineContentAnalysis = ({
  fetchInlineUrls = true,
  analyzeConvertedScripts = false,
  allowEscapeForVersioning = false,
} = {}) => {
  return [
    ...(fetchInlineUrls ? [jsenvPluginInlineContentFetcher()] : []),
    jsenvPluginHtmlInlineContentAnalysis({ analyzeConvertedScripts }),
    jsenvPluginJsInlineContentAnalysis({ allowEscapeForVersioning }),
    jsenvPluginDataUrls(),
  ];
};

const jsenvPluginInlineContentFetcher = () => {
  return {
    name: "jsenv:inline_content_fetcher",
    appliesDuring: "*",
    fetchUrlContent: (urlInfo) => {
      if (!urlInfo.isInline) {
        return null;
      }
      return {
        // we want to fetch the original content otherwise we might re-cook
        // content already cooked
        content: urlInfo.originalContent,
        contentType: urlInfo.contentType,
      };
    },
  };
};
