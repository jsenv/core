import { snapshotTests } from "@jsenv/snapshot";

import { createIntl } from "./intl.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic translation and interpolation", () => {
    const intl = createIntl({ systemLang: "fr" });
    intl.add("fr", {
      "one minute": "une minute",
      "{x} minutes": "{x} minutes",
      "one person": "une personne",
      "{x} persons": "{x} personnes",
    });
    return {
      "singular": intl.format("one minute"),
      "plural": intl.format("{x} minutes", { x: 3 }),
      "missing placeholder kept": intl.format("{x} minutes"),
    };
  });

  test("key returned as-is when not found in translations", () => {
    const intl = createIntl({ systemLang: "fr" });
    intl.add("fr", {});
    return {
      result: intl.format("one hour"),
    };
  });

  test("key returned as-is when no lang registered", () => {
    const intl = createIntl({ systemLang: "de" });
    intl.add("fr", { "one minute": "une minute" });
    return {
      result: intl.format("one minute"),
    };
  });

  test("lang matching — fr-CA falls back to fr", () => {
    const intl = createIntl({ systemLang: "fr-CA" });
    intl.add("fr", {
      "one minute": "une minute",
      "{x} minutes": "{x} minutes",
    });
    return {
      singular: intl.format("one minute"),
      plural: intl.format("{x} minutes", { x: 5 }),
    };
  });

  test("language inheritance — fr-provencal inherits from fr", () => {
    const intl = createIntl({ systemLang: "fr-provencal" });
    intl.add("fr", {
      "one minute": "une minute",
      "{x} minutes": "{x} minutes",
      "one person": "une personne",
    });
    intl.add("fr-provencal", {
      "one minute": "un minuto",
      "{x} minutes": "{x} minutos",
    });
    return {
      "overridden key": intl.format("one minute"),
      "overridden with interpolation": intl.format("{x} minutes", { x: 2 }),
      "inherited key": intl.format("one person"),
    };
  });

  test("bestLanguage updated when add called after creation", () => {
    const intl = createIntl({ systemLang: "fr" });
    const before = intl.format("one minute");
    intl.add("fr", { "one minute": "une minute" });
    const after = intl.format("one minute");
    return { before, after };
  });
});
