import { bundleJsModules } from "@jsenv/plugin-bundling";
import { injectQueryParams } from "@jsenv/urls";

const PACKAGE_BUNDLE_QUERY_PARAM = "package_bundle";
const DYNAMIC_IMPORT_QUERY_PARAM = "dynamic_import";

export const jsenvPluginWorkspaceBundle = ({ packageDirectory }) => {
  return {
    name: "jsenv:workspace_bundle",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      if (reference.searchParams.has(PACKAGE_BUNDLE_QUERY_PARAM)) {
        return null;
      }
      const { packageDirectoryUrl } = reference.urlInfo;
      if (!packageDirectoryUrl) {
        return null;
      }
      if (packageDirectoryUrl === packageDirectory.url) {
        // root package, we don't want to bundle
        return null;
      }
      // we make sure we target the bundle version of the package
      // otherwise we might execute some parts of the package code multiple times.
      // so we need to redirect the potential reference to non entry point to the package main entry point
      const packageJSON = packageDirectory.read(packageDirectoryUrl);
      reference.specifier = packageJSON.name;
      const packageMainUrl = reference.resolve();
      const packageBundleUrl = injectQueryParams(packageMainUrl, {
        [PACKAGE_BUNDLE_QUERY_PARAM]: "",
      });
      return packageBundleUrl;
    },
    fetchUrlContent: {
      js_module: async (urlInfo) => {
        const noBundleUrlInfo = urlInfo.getWithoutSearchParam(
          PACKAGE_BUNDLE_QUERY_PARAM,
        );
        if (!noBundleUrlInfo) {
          return null;
        }
        await noBundleUrlInfo.cook();
        await noBundleUrlInfo.cookDependencies({
          // we ignore dynamic import to cook lazyly (as browser request the server)
          // these dynamic imports must inherit "?package_bundle"
          // This is done inside rollup for convenience
          ignoreDynamicImport: true,
        });
        const bundleUrlInfos = await bundleJsModules([noBundleUrlInfo], {
          chunks: undefined,
          buildDirectoryUrl: new URL("./", import.meta.url),
          preserveDynamicImports: true,
          augmentDynamicImportUrlSearchParams: () => {
            return {
              [DYNAMIC_IMPORT_QUERY_PARAM]: "",
              [PACKAGE_BUNDLE_QUERY_PARAM]: "",
            };
          },
        });
        const bundledUrlInfo = bundleUrlInfos[noBundleUrlInfo.url];
        if (urlInfo.context.dev) {
          for (const sourceUrl of bundledUrlInfo.sourceUrls) {
            urlInfo.dependencies.inject({
              isImplicit: true,
              type: "js_url",
              specifier: sourceUrl,
            });
          }
        }
        return {
          content: bundledUrlInfo.content,
          contentType: "text/javascript",
          type: "js_module",
          originalUrl: urlInfo.originalUrl,
          originalContent: bundledUrlInfo.originalContent,
          sourcemap: bundledUrlInfo.sourcemap,
          data: bundledUrlInfo.data,
        };
      },
    },
  };
};
