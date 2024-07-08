/**

https://github.com/postcss/postcss/blob/master/docs/writing-a-plugin.md
https://github.com/postcss/postcss/blob/master/docs/guidelines/plugin.md
https://github.com/postcss/postcss/blob/master/docs/guidelines/runner.md#31-dont-show-js-stack-for-csssyntaxerror

In case css sourcemap contains no%20source
This is because of https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/map-generator.js#L231
and it indicates a node has been replaced without passing source
hence sourcemap cannot point the original source location

*/

import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const postCssPluginUrlVisitor = ({ urlVisitor = () => null }) => {
  const parseCssValue = require("postcss-value-parser");
  const stringifyCssNodes = parseCssValue.stringify;

  return {
    postcssPlugin: "url_visitor",
    prepare: (result) => {
      const { from } = result.opts;
      const fromUrl = String(pathToFileURL(from));
      const mutations = [];
      return {
        AtRule: {
          import: (atImportNode, { AtRule }) => {
            if (atImportNode.parent.type !== "root") {
              atImportNode.warn(result, "`@import` should be top level");
              return;
            }
            if (atImportNode.nodes) {
              atImportNode.warn(
                result,
                "`@import` was not terminated correctly",
              );
              return;
            }
            const parsed = parseCssValue(atImportNode.params);
            let [urlNode] = parsed.nodes;
            if (
              !urlNode ||
              (urlNode.type !== "string" && urlNode.type !== "function")
            ) {
              atImportNode.warn(
                result,
                `No URL in \`${atImportNode.toString()}\``,
              );
              return;
            }
            let url = "";
            if (urlNode.type === "string") {
              url = urlNode.value;
            } else if (urlNode.type === "function") {
              // Invalid function
              if (!/^url$/i.test(urlNode.value)) {
                atImportNode.warn(
                  result,
                  `Invalid \`url\` function in \`${atImportNode.toString()}\``,
                );
                return;
              }
              const firstNode = urlNode.nodes[0];
              if (firstNode && firstNode.type === "string") {
                urlNode = firstNode;
                url = urlNode.value;
              } else {
                urlNode = urlNode.nodes;
                url = stringifyCssNodes(urlNode.nodes);
              }
            }

            url = url.trim();
            if (url.length === 0) {
              atImportNode.warn(
                result,
                `Empty URL in \`${atImportNode.toString()}\``,
              );
              return;
            }

            const specifier = url;
            url = new URL(specifier, fromUrl).href;
            if (url === fromUrl) {
              atImportNode.warn(
                result,
                `\`@import\` loop in \`${atImportNode.toString()}\``,
              );
              return;
            }

            const atRuleStart = atImportNode.source.start.offset;
            const atRuleEnd = atImportNode.source.end.offset + 1; // for the ";"
            const atRuleRaw = atImportNode.source.input.css.slice(
              atRuleStart,
              atRuleEnd,
            );
            const specifierIndex = atRuleRaw.indexOf(atImportNode.params);
            const specifierStart = atRuleStart + specifierIndex;
            const specifierEnd =
              specifierStart + parsed.nodes[0].sourceEndIndex;
            const specifierLine = atImportNode.source.start.line;
            const specifierColumn =
              atImportNode.source.start.column + specifierIndex;
            urlVisitor({
              declarationNode: atImportNode,
              type: "@import",
              atRuleStart,
              atRuleEnd,
              specifier,
              specifierLine,
              specifierColumn,
              specifierStart,
              specifierEnd,
              replace: (newUrlSpecifier) => {
                if (newUrlSpecifier === urlNode.value) {
                  return;
                }
                urlNode.value = newUrlSpecifier;
                const newParams = parsed.toString();
                const newAtImportRule = new AtRule({
                  name: "import",
                  params: newParams,
                  source: atImportNode.source,
                });
                atImportNode.replaceWith(newAtImportRule);
              },
            });
          },
        },
        Declaration: (declarationNode) => {
          const parsed = parseCssValue(declarationNode.value);
          const urlMutations = [];
          walkUrls(parsed, {
            stringifyCssNodes,
            visitor: ({ url, urlNode }) => {
              // Empty URL
              if (!urlNode || url.length === 0) {
                declarationNode.warn(
                  result,
                  `Empty URL in \`${declarationNode.toString()}\``,
                );
                return;
              }
              // Skip Data URI
              if (isDataUrl(url)) {
                return;
              }
              const specifier = url;
              url = new URL(specifier, pathToFileURL(from));

              const declarationNodeStart = declarationNode.source.start.offset;
              const afterDeclarationNode =
                declarationNode.source.input.css.slice(declarationNodeStart);
              const valueIndex = afterDeclarationNode.indexOf(
                declarationNode.value,
              );
              const valueStart = declarationNodeStart + valueIndex;
              const specifierStart = valueStart + urlNode.sourceIndex;
              const specifierEnd =
                specifierStart +
                (urlNode.type === "word"
                  ? urlNode.value.length
                  : urlNode.value.length + 2); // the quotes
              // value raw
              // declarationNode.source.input.css.slice(valueStart)
              // specifier raw
              // declarationNode.source.input.css.slice(specifierStart, specifierEnd)
              const specifierLine = declarationNode.source.start.line;
              const specifierColumn =
                declarationNode.source.start.column +
                (specifierStart - declarationNodeStart);

              urlVisitor({
                declarationNode,
                type: "url",
                specifier,
                specifierLine,
                specifierColumn,
                specifierStart,
                specifierEnd,
                replace: (newUrlSpecifier) => {
                  urlMutations.push(() => {
                    // the specifier desires to be inside double quotes
                    if (newUrlSpecifier[0] === `"`) {
                      urlNode.type = "word";
                      urlNode.value = newUrlSpecifier;
                      return;
                    }
                    // the specifier desires to be inside simple quotes
                    if (newUrlSpecifier[0] === `'`) {
                      urlNode.type = "word";
                      urlNode.value = newUrlSpecifier;
                      return;
                    }
                    // the specifier desired to be just a word
                    // for the "word" type so that newUrlSpecifier can opt-out of being between quotes
                    // useful to inject __v__ calls for css inside js
                    urlNode.type = "word";
                    urlNode.value = newUrlSpecifier;
                  });
                },
              });
            },
          });
          if (urlMutations.length) {
            mutations.push(() => {
              urlMutations.forEach((urlMutation) => {
                urlMutation();
              });
              declarationNode.value = parsed.toString();
            });
          }
        },
        OnceExit: () => {
          mutations.forEach((mutation) => {
            mutation();
          });
        },
      };
    },
  };
};
postCssPluginUrlVisitor.postcss = true;

const walkUrls = (parsed, { stringifyCssNodes, visitor }) => {
  parsed.walk((node) => {
    // https://github.com/andyjansson/postcss-functions
    if (isUrlFunctionNode(node)) {
      const { nodes } = node;
      const [urlNode] = nodes;
      const url =
        urlNode && urlNode.type === "string"
          ? urlNode.value
          : stringifyCssNodes(nodes);
      visitor({
        url: url.trim(),
        urlNode,
      });
      return;
    }

    if (isImageSetFunctionNode(node)) {
      Array.from(node.nodes).forEach((childNode) => {
        if (childNode.type === "string") {
          visitor({
            url: childNode.value.trim(),
            urlNode: childNode,
          });
          return;
        }

        if (isUrlFunctionNode(node)) {
          const { nodes } = childNode;
          const [urlNode] = nodes;
          const url =
            urlNode && urlNode.type === "string"
              ? urlNode.value
              : stringifyCssNodes(nodes);
          visitor({
            url: url.trim(),
            urlNode,
          });
          return;
        }
      });
    }
  });
};

const isUrlFunctionNode = (node) => {
  return node.type === "function" && /^url$/i.test(node.value);
};

const isImageSetFunctionNode = (node) => {
  return (
    node.type === "function" && /^(?:-webkit-)?image-set$/i.test(node.value)
  );
};

const isDataUrl = (url) => {
  return /data:[^\n\r;]+(?:;charset=[^\n\r;]+)?;base64,[\d+/A-Za-z]+={0,2}/.test(
    url,
  );
};
