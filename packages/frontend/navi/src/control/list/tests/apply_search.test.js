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
    // because splitting on whitespace produces ["TC"] and "TCA" contains "TC".
    // "TC Adapter" is matched by the phrase path and highlights the space too.
    return displayTable([
      ["TC ", "TCA"],
      ["TC ", "TC Adapter"],
    ]);
  });

  test("multiple spaces between words", () => {
    // "a     b" collapses to words ["a","b"] for the word-loop,
    // but the literal phrase (with all spaces) is tried first.
    return displayTable([
      ["a     b", "a     b value"], // literal phrase matches
      ["a     b", "a b c"], // literal not found → word loop matches both
      ["a     b", "a c"], // only "a" matches → partial
      ["a     b", "xyz"], // no match
    ]);
  });

  test("only spaces as search", () => {
    return displayTable([
      [" ", "Bob"],
      [" ", " Bob"],
      ["  ", "Bob"],
      ["  ", "a  b"],
    ]);
  });

  test("leading spaces before word", () => {
    // "  bob" — two spaces then a word
    // Phase 1: literal "  bob" in the string
    // Phase 2: words = ["bob"] (spaces filtered), word-loop runs
    return displayTable([
      ["  bob", "Bob Martin"], // word-loop: "bob" found at start
      ["  bob", "  bob smith"], // literal phrase match
      ["  bob", "Jean bob"], // word-loop: "bob" found mid-word boundary
      ["  bob", "xyz"], // no match
    ]);
  });

  test("acronym matching", () => {
    return rank("TC", [
      "TC Adapter", // phrase match at start → higher score
      "Total Count", // acronym: T+C from word starts
      "The Champion", // acronym: T+C from word starts
      "tca", // phrase match mid-word
      "Taco", // no acronym match (only 1 word start)
      "xyz", // no match
    ]);
  });

  test("acronym with accent folding", () => {
    return displayTable([
      ["rg", "Rachel Guérin"], // R+G from word starts (accent-insensitive)
      ["RG", "Rachel Guérin"], // same, case-exact bonus
    ]);
  });

  test("acronym single char is skipped", () => {
    // Single-char acronym is too ambiguous, should not produce acronym matches
    // beyond what phrase/word already finds.
    return displayTable([
      ["b", "Bob Martin"], // phrase match (not acronym)
      ["z", "Bob Martin"], // no match
    ]);
  });
});
