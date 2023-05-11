export const parseAndTransformCssUrls = async (urlInfo, context) => {
  const { transform } = await import("lightningcss");

  const css = urlInfo.content;
  const cssAsBuffer = Buffer.from(css);
  const cssUrls = [];
  transform({
    code: cssAsBuffer,
    // see https://github.com/parcel-bundler/lightningcss/pull/25/files
    // analyzeDependencies: true,
    visitor: {
      Rule(ruleNode) {
        if (ruleNode.type === "import") {
          cssUrls.push({
            type: "import",
            line: ruleNode.value.loc.line,
            column: ruleNode.value.loc.column,
            specifier: ruleNode.value.url,
            replacement: null,
          });
        }
        return ruleNode;
      },
      Url(urlNode) {
        cssUrls.push({
          type: "url",
          line: urlNode.loc.line,
          column: urlNode.loc.column,
          specifier: urlNode.url,
          replacement: null,
        });
        return urlNode;
      },
    },
  });
  // create a reference for each css url
  await Promise.all(
    cssUrls.map(async (cssUrl) => {
      const [reference] = context.referenceUtils.found({
        type: cssUrl.type === "import" ? "css_@import" : "css_url",
        specifier: cssUrl.specifier,
      });
      const replacement = await context.referenceUtils.readGeneratedSpecifier(
        reference,
      );
      cssUrl.replacement = replacement.slice(1, -1);
    }),
  );
  // replace them
  const { code, map } = transform({
    code: cssAsBuffer,
    visitor: {
      Rule(ruleNode) {
        if (ruleNode.type === "import") {
          const cssUrl = cssUrls.find((cssUrlCandidate) => {
            return (
              cssUrlCandidate.line === ruleNode.value.loc.line &&
              cssUrlCandidate.column === ruleNode.value.loc.column &&
              cssUrlCandidate.specifier === ruleNode.value.url
            );
          });
          ruleNode.value.url = cssUrl.replacement;
        }
        return ruleNode;
      },
      Url(urlNode) {
        const cssUrl = cssUrls.find((cssUrlCandidate) => {
          return (
            cssUrlCandidate.line === urlNode.loc.line &&
            cssUrlCandidate.column === urlNode.loc.column &&
            cssUrlCandidate.specifier === urlNode.url
          );
        });
        urlNode.url = cssUrl.replacement;
        return urlNode;
      },
    },
  });

  const content = String(code);
  const sourcemap = JSON.parse(String(map));
  return { content, sourcemap };
};
