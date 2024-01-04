import { createMagicSource } from "@jsenv/sourcemap";
import { parseJsUrls } from "@jsenv/ast";

export const jsenvPluginImportMetaResolve = ({ needJsModuleFallback }) => {
  return {
    name: "jsenv:import_meta_resolve",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("import_meta_resolve")) {
        return false;
      }
      if (needJsModuleFallback(context)) {
        // will be handled by systemjs, keep it untouched
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo) => {
        const jsUrls = await parseJsUrls({
          js: urlInfo.content,
          url: urlInfo.url,
          isJsModule: true,
        });
        const magicSource = createMagicSource(urlInfo.content);
        for (const jsUrl of jsUrls) {
          if (jsUrl.subtype !== "import_meta_resolve") {
            continue;
          }
          const { node } = jsUrl.astInfo;
          let reference;
          for (const referenceToOther of urlInfo.referenceToOthersSet) {
            if (
              referenceToOther.generatedSpecifier.slice(1, -1) ===
              jsUrl.specifier
            ) {
              reference = referenceToOther;
              break;
            }
          }
          magicSource.replace({
            start: node.start,
            end: node.end,
            replacement: `new URL(${reference.generatedSpecifier}, import.meta.url).href`,
          });
        }
        return magicSource.toContentAndSourcemap();
      },
    },
  };
};
