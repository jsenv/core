import { createMagicSource } from "@jsenv/sourcemap";

export const jsenvPluginImportMetaResolve = () => {
  return {
    name: "jsenv:import_meta_resolve",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("import_meta_resolve")) {
        return false;
      }
      // keep it untouched, systemjs will handle it
      if (context.systemJsTranspilation) {
        return false;
      }
      return true;
    },
    transformUrlContent: {
      js_module: async (urlInfo, context) => {
        const magicSource = createMagicSource(urlInfo.content);
        context.referenceUtils._references.forEach((ref) => {
          if (ref.subtype === "import_meta_resolve") {
            const originalSpecifierLength = Buffer.byteLength(ref.specifier);
            const specifierLength = Buffer.byteLength(
              ref.generatedSpecifier.slice(1, -1), // remove `"` around
            );
            const specifierLengthDiff =
              specifierLength - originalSpecifierLength;
            const end = ref.node.end + specifierLengthDiff;
            magicSource.replace({
              start: ref.node.start,
              end,
              replacement: `new URL(${ref.generatedSpecifier}, import.meta.url).href`,
            });
            const currentLengthBeforeSpecifier = "import.meta.resolve(".length;
            const newLengthBeforeSpecifier = "new URL(".length;
            const lengthDiff =
              currentLengthBeforeSpecifier - newLengthBeforeSpecifier;
            ref.specifierColumn -= lengthDiff;
            ref.specifierStart -= lengthDiff;
            ref.specifierEnd =
              ref.specifierStart + Buffer.byteLength(ref.generatedSpecifier);
          }
        });
        return magicSource.toContentAndSourcemap();
      },
    },
  };
};
