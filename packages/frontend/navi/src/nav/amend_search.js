import { decodeUrlPart } from "./decode_url_part.js";

/**
 * A query edited as it was written.
 *
 * An address carries search pairs the edit knows nothing about: a tracking
 * param (utm_source, fbclid), a share ref, the search param of another route
 * matching the same address. Each stays byte for byte, where it stood. Only
 * the pairs whose name the edit decides change: the edit's own are written
 * together, in its order, where the first decided pair stood (at the end when
 * none did); a decided name the edit does not write is gone.
 *
 * URLSearchParams is no substitute: it rewrites every pair it keeps — "?weather"
 * into "?weather=", the commas of "?levels=3,4" encoded, which then reads back
 * as one array item (see extractSearchParams in route_pattern.js).
 *
 * @param {string} search the query amended, "?a=1&b" or ""
 * @param {(name: string) => boolean} decides whether the edit decides a pair
 *   named so (the name decoded); the names of `pairsWritten` are decided too
 * @param {string[]} [pairsWritten] the pairs the edit writes, as written
 * @returns {string} the query amended, "" when no pair is left
 */
export const amendSearch = (search, decides, pairsWritten = []) => {
  const namesWritten = new Set(pairsWritten.map(nameOfSearchPair));
  const pairs = [];
  let written = false;
  if (search.length > 1) {
    for (const pair of search.slice(1).split("&")) {
      const name = nameOfSearchPair(pair);
      if (!namesWritten.has(name) && !decides(name)) {
        pairs.push(pair);
        continue;
      }
      if (!written) {
        pairs.push(...pairsWritten);
        written = true;
      }
    }
  }
  if (!written) {
    pairs.push(...pairsWritten);
  }
  return pairs.length ? `?${pairs.join("&")}` : "";
};

// A key naming no text (see decodeUrlPart) is its own name, as written.
const nameOfSearchPair = (pair) => {
  const eqIndex = pair.indexOf("=");
  const key = eqIndex > -1 ? pair.slice(0, eqIndex) : pair;
  return decodeUrlPart(key) ?? key;
};
