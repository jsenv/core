/*
 * Source code can contain the following
 * - import.meta.dev
 * - import.meta.build
 * They are either:
 * - replaced by true: When scenario matches (import.meta.dev and it's the dev server)
 * - left as is to be evaluated to undefined (import.meta.build but it's the dev server)
 * - replaced by undefined (import.meta.dev but it's build; the goal is to ensure it's tree-shaked)
 *
 * TODO: ideally during dev we would keep import.meta.dev and ensure we set it to true rather than replacing it with true?
 */

import { getImportMetaPropertyName, visitJsAst } from "@jsenv/ast";
import { createMagicSource } from "@jsenv/sourcemap";

export const jsenvPluginImportMetaScenarios = () => {
  return {
    name: "jsenv:import_meta_scenario",
    appliesDuring: "*",
    transformUrlContent: {
      js_module: (urlInfo) => {
        // Do not scan node modules for import.meta.dev/import.meta.build
        // - node modules won't have this in their code
        // - ;or should use other an other technic as this one won't be available
        // They would be discarded by content.includes detection
        // but it's cheaper to detect by URL than to scan potentially large files
        if (urlInfo.url.includes("/node_modules/")) {
          return null;
        }
        if (
          !urlInfo.content.includes("import.meta.dev") &&
          !urlInfo.content.includes("import.meta.test") &&
          !urlInfo.content.includes("import.meta.build")
        ) {
          return null;
        }
        const importMetaScenarioNodes = { dev: [], build: [] };
        visitJsAst(urlInfo.contentAst, {
          MemberExpression: (node) => {
            const name = getImportMetaPropertyName(node);
            if (name === "dev" || name === "build") {
              importMetaScenarioNodes[name].push(node);
            }
          },
        });
        const { dev, build } = importMetaScenarioNodes;
        const replacements = [];
        const replace = (node, value) => {
          replacements.push({ node, value });
        };
        if (urlInfo.context.build) {
          // during build ensure replacement for tree-shaking
          dev.forEach((node) => {
            replace(node, "undefined");
          });
          build.forEach((node) => {
            replace(node, "true");
          });
        } else {
          // during dev we can let "import.meta.build" untouched
          // it will be evaluated to undefined.
          // Moreover it can be surprising to see some "undefined"
          // when source file contains "import.meta.build"
          dev.forEach((node) => {
            replace(node, "true");
          });
        }
        const magicSource = createMagicSource(urlInfo.content);
        replacements.forEach(({ node, value }) => {
          magicSource.replace({
            start: node.start,
            end: node.end,
            replacement: value,
          });
        });
        return magicSource.toContentAndSourcemap();
      },
    },
  };
};
