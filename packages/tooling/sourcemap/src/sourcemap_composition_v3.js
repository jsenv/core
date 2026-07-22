/*
 * https://github.com/mozilla/source-map#sourcemapgenerator
 */

import { requireSourcemap } from "./require_sourcemap.js";

const { SourceMapConsumer, SourceMapGenerator } = requireSourcemap();

// "first" maps an intermediate content back to the true original source(s);
// "second" maps the final content back to that same intermediate content
// (its "original" positions live in the coordinate space "first" was
// generated for). Composing them means chaining through "first" for every
// mapping in "second" — not merging both mapping sets side by side: they
// don't share a single coordinate space, so naively adding both to the same
// generator produces mappings that silently collide/override each other
// wherever "second" happens to cover a position "first" also maps.
export const composeTwoSourcemaps = (firstSourcemap, secondSourcemap) => {
  if (!firstSourcemap && !secondSourcemap) {
    return null;
  }
  if (!firstSourcemap) {
    return secondSourcemap;
  }
  if (!secondSourcemap) {
    return firstSourcemap;
  }
  const sourcemapGenerator = new SourceMapGenerator();
  const firstSourcemapConsumer = new SourceMapConsumer(firstSourcemap);
  const secondSourcemapConsumer = new SourceMapConsumer(secondSourcemap);
  secondSourcemapConsumer.eachMapping(
    ({
      generatedLine,
      generatedColumn,
      originalLine,
      originalColumn,
      name,
    }) => {
      if (typeof originalColumn !== "number") {
        // "second" has no original position here (e.g. injected/synthetic
        // content) — nothing to chain through "first", leave unmapped.
        return;
      }
      const original = firstSourcemapConsumer.originalPositionFor({
        line: originalLine,
        column: originalColumn,
      });
      if (original.source == null) {
        // "first" has no mapping covering that intermediate position either
        // — leave unmapped rather than guessing.
        return;
      }
      sourcemapGenerator.addMapping({
        generated: { line: generatedLine, column: generatedColumn },
        original: { line: original.line, column: original.column },
        source: original.source,
        name: original.name || name || undefined,
      });
    },
  );
  const sourcemap = sourcemapGenerator.toJSON();
  const sources = [];
  const sourcesContent = [];
  const firstSourcesContent = firstSourcemap.sourcesContent;
  sourcemap.sources.forEach((source) => {
    sources.push(source);
    if (firstSourcesContent) {
      const firstSourceIndex = firstSourcemap.sources.indexOf(source);
      if (firstSourceIndex > -1) {
        sourcesContent.push(firstSourcesContent[firstSourceIndex]);
        return;
      }
    }
    sourcesContent.push(null);
  });
  sourcemap.sources = sources;
  sourcemap.sourcesContent = sourcesContent;
  return sourcemap;
};
