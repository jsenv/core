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
  toDecodedMap,
  toEncodedMap,
} from "@jridgewell/gen-mapping";
import {
  eachMapping,
  originalPositionFor,
  TraceMap,
} from "@jridgewell/trace-mapping";

export const composeTwoSourcemaps = (firstSourcemap, secondSourcemap) => {
  return composeSourcemaps([firstSourcemap, secondSourcemap]);
};

// A chain [A, B, C] where each map describes the content the next one was
// generated from: A maps the oldest content back to the true source(s),
// C maps the final content back to B's output. Composing pairwise left to
// right is the correct semantic, but a standalone pairwise composition
// encodes its result to VLQ mappings only for the next pair to decode them
// again; here intermediate results stay decoded and encoding happens once,
// on the last pair. Falsy entries are skipped (a step that produced no map).
export const composeSourcemaps = (sourcemaps) => {
  const maps = [];
  for (const sourcemap of sourcemaps) {
    if (sourcemap) {
      maps.push(sourcemap);
    }
  }
  if (maps.length === 0) {
    return null;
  }
  if (maps.length === 1) {
    return maps[0];
  }
  const headSourcemap = maps[0];
  let traceMap = new TraceMap(headSourcemap);
  let genMapping;
  for (let i = 1; i < maps.length; i++) {
    if (genMapping) {
      // TraceMap accepts decoded mappings: no VLQ roundtrip between pairs
      traceMap = new TraceMap(toDecodedMap(genMapping));
    }
    genMapping = composePairIntoGenMapping(traceMap, new TraceMap(maps[i]));
  }
  const encodedMap = toEncodedMap(genMapping);
  const sourcemap = {
    version: 3,
    sources: [...encodedMap.sources],
    names: [...encodedMap.names],
    mappings: encodedMap.mappings,
  };
  // sourcesContent is taken from the head map: every source surviving the
  // composition originates from it (a later map's "sources" describe
  // intermediate contents, not true sources).
  const sourcesContent = [];
  const headSourcesContent = headSourcemap.sourcesContent;
  sourcemap.sources.forEach((source) => {
    if (headSourcesContent) {
      const headSourceIndex = headSourcemap.sources.indexOf(source);
      if (headSourceIndex > -1) {
        sourcesContent.push(headSourcesContent[headSourceIndex]);
        return;
      }
    }
    sourcesContent.push(null);
  });
  sourcemap.sourcesContent = sourcesContent;
  return sourcemap;
};

// "first" maps an intermediate content back to the true original source(s);
// "second" maps the final content back to that same intermediate content
// (its "original" positions live in the coordinate space "first" was
// generated for). Composing them means chaining through "first" for every
// mapping in "second" — not merging both mapping sets side by side: they
// don't share a single coordinate space, so naively adding both to the same
// generator produces mappings that silently collide/override each other
// wherever "second" happens to cover a position "first" also maps.
const composePairIntoGenMapping = (firstTraceMap, secondTraceMap) => {
  const genMapping = new GenMapping();
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
  return genMapping;
};
