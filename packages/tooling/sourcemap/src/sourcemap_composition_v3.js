/*
 * https://github.com/jridgewell/trace-mapping
 * https://github.com/jridgewell/gen-mapping
 *
 * @jridgewell/* rather than source-map-js (still used by
 * original_position.js): composing is the hot spot of a build with
 * sourcemaps, and source-map-js sorts + binary searches its mappings on
 * every lookup where trace-mapping walks them in order. On @jsenv/navi
 * (3MB bundle, 18MB map) the build went from 11s to 4.6s for a map that is
 * byte for byte the one source-map-js produced.
 */

import {
  addMapping,
  GenMapping,
  toEncodedMap,
} from "@jridgewell/gen-mapping";
import {
  eachMapping,
  originalPositionFor,
  TraceMap,
} from "@jridgewell/trace-mapping";

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
  const genMapping = new GenMapping();
  const firstTraceMap = new TraceMap(firstSourcemap);
  const secondTraceMap = new TraceMap(secondSourcemap);
  eachMapping(
    secondTraceMap,
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
      const original = originalPositionFor(firstTraceMap, {
        line: originalLine,
        column: originalColumn,
      });
      if (original.source === null) {
        // "first" has no mapping covering that intermediate position either
        // — leave unmapped rather than guessing.
        return;
      }
      // addMapping, not maybeAddMapping: the latter drops mappings it
      // considers redundant with the previous one, which shrinks the map
      // but loses positions (a real fidelity change, to decide on its own).
      addMapping(genMapping, {
        generated: { line: generatedLine, column: generatedColumn },
        original: { line: original.line, column: original.column },
        source: original.source,
        name: original.name || name || undefined,
      });
    },
  );
  const encodedMap = toEncodedMap(genMapping);
  const sourcemap = {
    version: 3,
    sources: [...encodedMap.sources],
    names: [...encodedMap.names],
    mappings: encodedMap.mappings,
  };
  const sourcesContent = [];
  const firstSourcesContent = firstSourcemap.sourcesContent;
  sourcemap.sources.forEach((source) => {
    if (firstSourcesContent) {
      const firstSourceIndex = firstSourcemap.sources.indexOf(source);
      if (firstSourceIndex > -1) {
        sourcesContent.push(firstSourcesContent[firstSourceIndex]);
        return;
      }
    }
    sourcesContent.push(null);
  });
  sourcemap.sourcesContent = sourcesContent;
  return sourcemap;
};
