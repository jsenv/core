import { snapshotTests } from "@jsenv/snapshot";
import { applySearch } from "../apply_search.js";

// Display helper: shows the value with [matched] wrapping matched ranges.
// Non-matches show the raw value with "no match".
const display = (searchText, value) => {
  const result = applySearch(searchText, value);
  const str = String(value);
  if (!result.match) {
    return `${str}  (no match)`;
  }
  const ranges = [...result.matchRanges].sort((a, b) => a[0] - b[0]);
  let out = "";
  let cursor = 0;
  for (const [start, end] of ranges) {
    out += str.slice(cursor, start);
    out += `[${str.slice(start, end)}]`;
    cursor = end;
  }
  out += str.slice(cursor);
  return out;
};

// Sort values by score descending, return formatted ranking.
const rank = (searchText, values) => {
  return values
    .map((value) => {
      const result = applySearch(searchText, value);
      return { value, score: result.matchScore, match: result.match };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ value, match }) =>
      match ? display(searchText, value) : `${value}  (no match)`,
    );
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("empty searchText", () => {
    return [display("", "Bob Martin"), display("", "Guérin")];
  });

  test("single-word matches", () => {
    return [
      display("bob", "Bob Martin"), // at start, case-insensitive
      display("Bob", "Bob Martin"), // at start, case-exact
      display("mar", "Bob Martin"), // in middle, case-insensitive
      display("Mar", "Bob Martin"), // in middle, case-exact
      display("a", "banana"), // multiple occurrences
      display("xyz", "Bob Martin"), // no match
    ];
  });

  test("accent folding", () => {
    return [
      display("elie", "Élie Dupont"), // unaccented search → accented value at start
      display("gue", "Rachel Guérin"), // unaccented search → accented value in middle
      display("é", "Elise"), // accented search → unaccented value
      display("é", "Élie"), // accented search → accented value
      display("elie", "Elise Dupont"), // no accent involved
    ];
  });

  test("multi-word matches", () => {
    return [
      display("bob mar", "Bob Martin"), // first word at start
      display("mar bob", "Bob Martin"), // second word at start
      display("rachel gue", "Rachel Guérin"), // with accent folding
      display("martin bob", "Bob Martin"), // words in reverse order
      display("Bob Mar", "Bob Martin"), // case-exact multi-word
      display("bob xyz", "Bob Martin"), // one word missing → no match
    ];
  });

  test("score ranking", () => {
    return rank("bob", [
      "bob smith", // starts with (case-exact) → best
      "Bob Martin", // starts with (case-insensitive)
      "Jean-bob Dupont", // contains (case-exact)
      "Jean-Bob Dupont", // contains (case-insensitive)
      "Alice", // no match
    ]);
  });

  test("score ranking multi-word", () => {
    return rank("bob mar", [
      "Bob Martin", // first word at start
      "Mar Bob", // second word at start
      "Jean Bob du Mar", // both words inside
      "Bob xyz", // one word missing → no match
    ]);
  });
});
