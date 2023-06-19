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
      js_module: async (urlInfo) => {
        const magicSource = createMagicSource(urlInfo.content);
        urlInfo.dependencySet.forEach((dependencyReference) => {
          if (dependencyReference.subtype === "import_meta_resolve") {
            const originalSpecifierLength = Buffer.byteLength(
              dependencyReference.specifier,
            );
            const specifierLength = Buffer.byteLength(
              dependencyReference.generatedSpecifier.slice(1, -1), // remove `"` around
            );
            const specifierLengthDiff =
              specifierLength - originalSpecifierLength;
            const end = dependencyReference.node.end + specifierLengthDiff;
            magicSource.replace({
              start: dependencyReference.node.start,
              end,
              replacement: `new URL(${dependencyReference.generatedSpecifier}, import.meta.url).href`,
            });
            const currentLengthBeforeSpecifier = "import.meta.resolve(".length;
            const newLengthBeforeSpecifier = "new URL(".length;
            const lengthDiff =
              currentLengthBeforeSpecifier - newLengthBeforeSpecifier;
            dependencyReference.specifierColumn -= lengthDiff;
            dependencyReference.specifierStart -= lengthDiff;
            dependencyReference.specifierEnd =
              dependencyReference.specifierStart +
              Buffer.byteLength(dependencyReference.generatedSpecifier);
          }
        });
        return magicSource.toContentAndSourcemap();
      },
    },
  };
};
