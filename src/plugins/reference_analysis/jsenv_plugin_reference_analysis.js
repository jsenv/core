import { URL_META } from "@jsenv/url-meta";

import { jsenvPluginReferenceExpectedTypes } from "./jsenv_plugin_reference_expected_types.js";
import { jsenvPluginDirectoryReferenceAnalysis } from "./directory/jsenv_plugin_directory_reference_analysis.js";
import { jsenvPluginDataUrlsAnalysis } from "./data_urls/jsenv_plugin_data_urls_analysis.js";
import { jsenvPluginHtmlReferenceAnalysis } from "./html/jsenv_plugin_html_reference_analysis.js";
import { jsenvPluginWebmanifestReferenceAnalysis } from "./webmanifest/jsenv_plugin_webmanifest_reference_analysis.js";
import { jsenvPluginCssReferenceAnalysis } from "./css/jsenv_plugin_css_reference_analysis.js";
import { jsenvPluginJsReferenceAnalysis } from "./js/jsenv_plugin_js_reference_analysis.js";

export const jsenvPluginReferenceAnalysis = ({
  include,
  supportedProtocols = ["file:", "data:", "virtual:", "http:", "https:"],

  inlineContent = true,
  inlineConvertedScript = false,
  fetchInlineUrls = true,
  allowEscapeForVersioning = false,
}) => {
  return [
    jsenvPluginReferenceAnalysisInclude({
      include,
      supportedProtocols,
    }),
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

const jsenvPluginReferenceAnalysisInclude = ({
  include,
  supportedProtocols,
}) => {
  // eslint-disable-next-line no-unused-vars
  let getIncludeInfo = (url) => undefined;

  return {
    name: "jsenv:reference_analysis_include",
    appliesDuring: "*",
    init: ({ rootDirectoryUrl }) => {
      if (include) {
        const associations = URL_META.resolveAssociations(
          { include },
          rootDirectoryUrl,
        );
        getIncludeInfo = (url) => {
          const { include } = URL_META.applyAssociations({
            url,
            associations,
          });
          return include;
        };
      }
    },
    redirectReference: (reference) => {
      if (reference.mustIgnore !== undefined) {
        return;
      }
      if (
        reference.specifier[0] === "#" &&
        // For Html, css and in general "#" refer to a resource in the page
        // so that urls must be kept intact
        // However for js import specifiers they have a different meaning and we want
        // to resolve them (https://nodejs.org/api/packages.html#imports for instance)
        reference.type !== "js_import"
      ) {
        reference.mustIgnore = true;
        return;
      }
      const includeInfo = getIncludeInfo(reference.url);
      if (includeInfo === true) {
        reference.mustIgnore = false;
        return;
      }
      if (includeInfo === false) {
        reference.mustIgnore = true;
        return;
      }
      const { protocol } = new URL(reference.url);
      const protocolIsSupported = supportedProtocols.some(
        (supportedProtocol) => protocol === supportedProtocol,
      );
      reference.mustIgnore = !protocolIsSupported;
    },
    formatReference: (reference) => {
      if (reference.generatedUrl.startsWith("ignore:")) {
        return reference.generatedUrl.slice("ignore:".length);
      }
      return null;
    },
  };
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
