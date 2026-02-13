import { bundleJsModules } from "@jsenv/plugin-bundling";
import { injectQueryParams, injectQueryParamsIntoSpecifier } from "@jsenv/urls";

const PACKAGE_BUNDLE_QUERY_PARAM = "package_bundle";
const PACKAGE_NO_BUNDLE_QUERY_PARAM = "package_no_bundle";
const DYNAMIC_IMPORT_QUERY_PARAM = "dynamic_import";

export const jsenvPluginWorkspaceBundle = ({ packageDirectory }) => {
  return {
    name: "jsenv:workspace_bundle",
    appliesDuring: "dev",
    redirectReference: (reference) => {
      if (!reference.url.startsWith("file:")) {
        return null;
      }
      if (reference.searchParams.has(PACKAGE_BUNDLE_QUERY_PARAM)) {
        return null;
      }
      if (reference.searchParams.has(PACKAGE_NO_BUNDLE_QUERY_PARAM)) {
        return null;
      }
      if (
        reference.ownerUrlInfo.searchParams.has(PACKAGE_NO_BUNDLE_QUERY_PARAM)
      ) {
        // we're cooking the bundle, without this check we would have infinite recursion to try to bundle
        // we want to propagate the ?package_no_bundle
        const noBundleUrl = injectQueryParams(reference.url, {
          v: undefined,
          [PACKAGE_NO_BUNDLE_QUERY_PARAM]: "",
        });
        // console.log(
        //   `redirecting ${reference.url} to ${noBundleUrl} to cook the bundle`,
        // );
        return noBundleUrl;
      }
      const packageDirectoryUrl = packageDirectory.find(reference.url);
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
      const rootReference = reference.ownerUrlInfo.dependencies.inject({
        type: "js_import",
        specifier: `${packageJSON.name}?${PACKAGE_BUNDLE_QUERY_PARAM}`,
      });
      // console.log(
      //   `redirecting ${reference.url} to ${rootReference.url} to target the package bundle version of the package`,
      // );
      const packageMainUrl = rootReference.url;
      return packageMainUrl;
    },
    fetchUrlContent: async (urlInfo) => {
      if (!urlInfo.searchParams.has(PACKAGE_BUNDLE_QUERY_PARAM)) {
        return null;
      }
      const noBundleSpecifier = injectQueryParamsIntoSpecifier(
        urlInfo.firstReference.specifier,
        {
          [PACKAGE_BUNDLE_QUERY_PARAM]: undefined,
          [PACKAGE_NO_BUNDLE_QUERY_PARAM]: "",
        },
      );
      const noBundleUrlInfo = urlInfo.redirect({
        specifier: noBundleSpecifier,
      });
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
        chunks: false,
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
    // transformReferenceSearchParams: () => {
    //   return {
    //     [PACKAGE_BUNDLE_QUERY_PARAM]: undefined,
    //   };
    // },
  };
};
