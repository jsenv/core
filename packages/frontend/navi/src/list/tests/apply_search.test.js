import { snapshotTests } from "@jsenv/snapshot";
import { applySearch } from "../apply_search.js";

await snapshotTests(import.meta.url, ({ test }) => {
  // --- empty searchText ---

  test("empty searchText", () => {
    return applySearch("", "Bob Martin");
  });

  // --- single-word, phrase match ---

  test("phrase match at start (case-insensitive)", () => {
    return applySearch("bob", "Bob Martin");
  });

  test("phrase match in middle (case-insensitive)", () => {
    return applySearch("mar", "Bob Martin");
  });

  test("phrase match at start (case-exact)", () => {
    return applySearch("Bob", "Bob Martin");
  });

  test("phrase match in middle (case-exact)", () => {
    return applySearch("Mar", "Bob Martin");
  });

  test("no match", () => {
    return applySearch("xyz", "Bob Martin");
  });

  test("multiple occurrences", () => {
    return applySearch("a", "banana");
  });

  // --- accent folding ---

  test("accent-insensitive match at start", () => {
    return applySearch("elie", "Élie Dupont");
  });

  test("accent-insensitive match in middle", () => {
    return applySearch("gue", "Rachel Guérin");
  });

  test("accented searchText matches unaccented value", () => {
    return applySearch("é", "Elise");
  });

  test("accented searchText matches accented value", () => {
    return applySearch("é", "Élie");
  });

  // --- multi-word ---

  test("multi-word all words match", () => {
    return applySearch("rachel gue", "Rachel Guérin");
  });

  test("multi-word first word at start", () => {
    return applySearch("bob mar", "Bob Martin");
  });

  test("multi-word second word at start", () => {
    return applySearch("mar bob", "Bob Martin");
  });

  test("multi-word one word missing", () => {
    return applySearch("bob xyz", "Bob Martin");
  });

  test("multi-word all words match with case-exact", () => {
    return applySearch("Bob Mar", "Bob Martin");
  });

  test("multi-word words match in different order", () => {
    return applySearch("martin bob", "Bob Martin");
  });

  // --- score ordering ---

  test("phrase beats multi-word (same characters)", () => {
    const phraseResult = applySearch("bob martin", "Bob Martin");
    const multiResult = applySearch("bob mar", "Bob Martin");
    return {
      phraseScore: phraseResult.matchScore,
      multiScore: multiResult.matchScore,
      phraseBeatsMulti: phraseResult.matchScore > multiResult.matchScore,
    };
  });
});
