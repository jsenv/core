import { bundleJsModules } from "@jsenv/plugin-bundling";

export const jsenvPluginWorkspaceBundle = ({ packageDirectory }) => {
  return {
    name: "jsenv:workspace_bundle",
    appliesDuring: "dev",
    urlInfoCreated: (urlInfo) => {
      const url = urlInfo.url;
      if (!url.startsWith("file:")) {
        return;
      }
      const closestPackageDirectoryUrl = packageDirectory.find(url);
      urlInfo.packageDirectoryUrl = closestPackageDirectoryUrl;
    },
    transformUrlContent: {
      js_module: async (urlInfo) => {
        if (!urlInfo.packageDirectoryUrl) {
          return null;
        }
        console.log(urlInfo.context.requestedUrl, urlInfo.context.request);
        return null;
        debugger;
        // cook it to get content + dependencies
        await urlInfo.cook();
        await urlInfo.cookDependencies({
          // we ignore dynamic import to cook lazyly (as browser request the server)
          // these dynamic imports must inherit "?as_js_classic"
          // This is done inside rollup for convenience
          ignoreDynamicImport: true,
        });
        const bundleUrlInfos = await bundleJsModules([urlInfo], {
          chunks: undefined,
          buildDirectoryUrl: new URL("./", import.meta.url),
          preserveDynamicImports: true,
          augmentDynamicImportUrlSearchParams: () => {
            return {
              dynamic_import: "",
            };
          },
        });
        const bundledUrlInfo = bundleUrlInfos[urlInfo.url];
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
