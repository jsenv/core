/*
 * https://github.com/parcel-bundler/parcel/blob/v2/packages/transformers/css/src/CSSTransformer.js
 */

import { parseCssUrls } from "@jsenv/ast";
import { createMagicSource } from "@jsenv/sourcemap";

export const parseAndTransformCssUrls = async (urlInfo, context) => {
  const cssUrls = await parseCssUrls({
    css: urlInfo.content,
    url: urlInfo.originalUrl,
  });
  const actions = [];
  const magicSource = createMagicSource(urlInfo.content);
  for (const cssUrl of cssUrls) {
    const [reference] = context.referenceUtils.found({
      type: cssUrl.type,
      specifier: cssUrl.specifier,
      specifierStart: cssUrl.start,
      specifierEnd: cssUrl.end,
      specifierLine: cssUrl.line,
      specifierColumn: cssUrl.column,
    });
    actions.push(async () => {
      const replacement = await context.referenceUtils.readGeneratedSpecifier(
        reference,
      );
      magicSource.replace({
        start: cssUrl.start,
        end: cssUrl.end,
        replacement,
      });
    });
  }
  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()));
  }
  return magicSource.toContentAndSourcemap();
};
