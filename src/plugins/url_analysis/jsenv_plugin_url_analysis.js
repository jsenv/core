import { URL_META } from "@jsenv/url-meta";
import { urlToRelativeUrl } from "@jsenv/urls";

import { jsenvPluginReferenceExpectedTypes } from "./jsenv_plugin_reference_expected_types.js";
import { parseAndTransformHtmlUrls } from "./html/html_urls.js";
import { parseAndTransformCssUrls } from "./css/css_urls.js";
import { parseAndTransformJsUrls } from "./js/js_urls.js";
import { parseAndTransformWebmanifestUrls } from "./webmanifest/webmanifest_urls.js";

export const jsenvPluginUrlAnalysis = ({
  rootDirectoryUrl,
  include,
  supportedProtocols = ["file:", "data:", "virtual:", "http:", "https:"],
}) => {
  // eslint-disable-next-line no-unused-vars
  let getIncludeInfo = (url) => undefined;
  if (include) {
    const associations = URL_META.resolveAssociations(
      { include },
      rootDirectoryUrl,
    );
    getIncludeInfo = (url) => {
      const { include } = URL_META.applyAssociations({ url, associations });
      return include;
    };
  }

  return [
    {
      name: "jsenv:url_analysis",
      appliesDuring: "*",
      redirectReference: (reference) => {
        if (reference.shouldHandle !== undefined) {
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
          reference.shouldHandle = false;
          return;
        }
        const includeInfo = getIncludeInfo(reference.url);
        if (includeInfo === true) {
          reference.shouldHandle = true;
          return;
        }
        if (includeInfo === false) {
          reference.shouldHandle = false;
          return;
        }
        const { protocol } = new URL(reference.url);
        const protocolIsSupported = supportedProtocols.some(
          (supportedProtocol) => protocol === supportedProtocol,
        );
        if (protocolIsSupported) {
          reference.shouldHandle = true;
        }
      },
      transformUrlContent: {
        html: parseAndTransformHtmlUrls,
        css: parseAndTransformCssUrls,
        js_classic: parseAndTransformJsUrls,
        js_module: parseAndTransformJsUrls,
        webmanifest: parseAndTransformWebmanifestUrls,
        directory: (urlInfo, context) => {
          const originalDirectoryReference = findOriginalDirectoryReference(
            urlInfo,
            context,
          );
          const directoryRelativeUrl = urlToRelativeUrl(
            urlInfo.url,
            context.rootDirectoryUrl,
          );
          JSON.parse(urlInfo.content).forEach((directoryEntryName) => {
            context.referenceUtils.found({
              type: "filesystem",
              subtype: "directory_entry",
              specifier: directoryEntryName,
              trace: {
                message: `"${directoryRelativeUrl}${directoryEntryName}" entry in directory referenced by ${originalDirectoryReference.trace.message}`,
              },
            });
          });
        },
      },
    },
    jsenvPluginReferenceExpectedTypes(),
  ];
};

const findOriginalDirectoryReference = (urlInfo, context) => {
  const findNonFileSystemAncestor = (urlInfo) => {
    for (const dependentUrl of urlInfo.dependents) {
      const dependentUrlInfo = context.urlGraph.getUrlInfo(dependentUrl);
      if (dependentUrlInfo.type !== "directory") {
        return [dependentUrlInfo, urlInfo];
      }
      const found = findNonFileSystemAncestor(dependentUrlInfo);
      if (found) {
        return found;
      }
    }
    return [];
  };
  const [ancestor, child] = findNonFileSystemAncestor(urlInfo);
  if (!ancestor) {
    return null;
  }
  const ref = ancestor.references.find((ref) => ref.url === child.url);
  return ref;
};
