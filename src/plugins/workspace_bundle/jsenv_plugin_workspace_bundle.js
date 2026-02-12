import { bundleJsModules } from "@jsenv/plugin-bundling";

export const jsenvPluginWorkspaceBundle = ({ packageDirectory }) => {
  return {
    name: "jsenv:workspace_bundle",
    appliesDuring: "dev",
    transformUrlContent: {
      js_module: async (urlInfo) => {
        const { packageDirectoryUrl } = urlInfo;

        if (!packageDirectoryUrl) {
          return null;
        }
        if (packageDirectoryUrl === packageDirectory.url) {
          // root package
          return null;
        }
        console.log("should bundle", urlInfo.url);
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
