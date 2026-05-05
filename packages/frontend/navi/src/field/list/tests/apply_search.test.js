import { snapshotTests } from "@jsenv/snapshot";
import { displayTable, rank } from "./test_utils.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("empty searchText", () => {
    return displayTable([
      ["", "Bob Martin"],
      ["", "Guérin"],
    ]);
  });

  test("single-word matches", () => {
    return displayTable([
      ["bob", "Bob Martin"], // at start, case-insensitive
      ["Bob", "Bob Martin"], // at start, case-exact
      ["mar", "Bob Martin"], // in middle, case-insensitive
      ["Mar", "Bob Martin"], // in middle, case-exact
      ["a", "banana"], // multiple occurrences
      ["xyz", "Bob Martin"], // no match
    ]);
  });

  test("accent folding", () => {
    return displayTable([
      ["elie", "Élie Dupont"], // unaccented search → accented value at start
      ["gue", "Rachel Guérin"], // unaccented search → accented value in middle
      ["é", "Elise"], // accented search → unaccented value
      ["é", "Élie"], // accented search → accented value
      ["elie", "Elise Dupont"], // no accent involved
    ]);
  });

  test("multi-word matches", () => {
    return displayTable([
      ["bob mar", "Bob Martin"], // first word at start
      ["mar bob", "Bob Martin"], // second word at start
      ["rachel gue", "Rachel Guérin"], // with accent folding
      ["martin bob", "Bob Martin"], // words in reverse order
      ["Bob Mar", "Bob Martin"], // case-exact multi-word
      ["bob xyz", "Bob Martin"], // one word matches (OR) → partial match
    ]);
  });

  test("score ranking", () => {
    return rank("bob", [
      "bob smith", // starts with (case-exact) → best
      "Bob Martin", // starts with (case-insensitive)
      "Jean-bob Dupont", // after word boundary (case-exact)
      "Jean-Bob Dupont", // after word boundary (case-insensitive)
      "Jacobin", // mid-word → lowest match
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

  test("trailing space in search", () => {
    // "TC " (with trailing space) should still match "TCA"
    // because splitting on whitespace produces ["TC"] and "TCA" contains "TC"
    return displayTable([
      ["TC ", "TCA"],
      ["TC ", "TC Adapter"],
    ]);
  });
});
