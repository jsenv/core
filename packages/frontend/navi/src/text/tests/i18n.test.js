import { snapshotTests } from "@jsenv/snapshot";

import { createI18n } from "../i18n.js";

await snapshotTests(import.meta.url, ({ test }) => {
  // --- opaque keys (default mode) ---

  test("opaque key: registered translation returned", () => {
    const i18n = createI18n({ systemLang: "fr" });
    i18n.add("one minute", { fr: "une minute" });
    return {
      result: i18n("one minute"),
    };
  });

  test("opaque key: key returned as-is when not found", () => {
    const i18n = createI18n({ systemLang: "fr" });
    i18n.add("one minute", { fr: "une minute" });
    return {
      result: i18n("one hour"),
    };
  });

  test("opaque key: key returned as-is when no lang registered", () => {
    const i18n = createI18n({ systemLang: "de" });
    i18n.add("one minute", { fr: "une minute" });
    return {
      result: i18n("one minute"),
    };
  });

  test("opaque key: interpolation with [x] placeholders", () => {
    const i18n = createI18n({ systemLang: "fr" });
    i18n.add("[x] minutes", { fr: "[x] minutes" });
    return {
      "with value": i18n("[x] minutes", { x: 3 }),
      "missing placeholder kept": i18n("[x] minutes"),
    };
  });

  // --- keyLang mode ---

  test("keyLang: key doubles as translation for keyLang", () => {
    const i18n = createI18n({ systemLang: "en", keyLang: "en" });
    i18n.add("Hello [name]!", { fr: "Bonjour [name] !" });
    return {
      en: i18n("Hello [name]!", { name: "Alice" }),
      fr: i18n("Hello [name]!", { name: "Alice" }, { lang: "fr" }),
    };
  });

  test("keyLang: key returned as-is for unknown lang (not treated as keyLang template)", () => {
    const i18n = createI18n({ systemLang: "de", keyLang: "en" });
    i18n.add("Hello!", { fr: "Bonjour !" });
    return {
      result: i18n("Hello!"),
    };
  });

  test("keyLang: regional variant of keyLang also uses key as template", () => {
    const i18n = createI18n({ systemLang: "en-GB", keyLang: "en" });
    i18n.add("Hello!", { fr: "Bonjour !" });
    return {
      result: i18n("Hello!"),
    };
  });

  // --- lang matching ---

  test("fr-CA falls back to fr", () => {
    const i18n = createI18n({ systemLang: "fr-CA" });
    i18n.add("one minute", { fr: "une minute" });
    i18n.add("[x] minutes", { fr: "[x] minutes" });
    return {
      singular: i18n("one minute"),
      plural: i18n("[x] minutes", { x: 5 }),
    };
  });

  test("regional variant inherits from parent, own keys override", () => {
    const i18n = createI18n({ systemLang: "fr-provencal" });
    i18n.addLangKeys("fr", {
      "one minute": "une minute",
      "[x] minutes": "[x] minutes",
      "one person": "une personne",
    });
    i18n.addLangKeys("fr-provencal", {
      "one minute": "un minuto",
      "[x] minutes": "[x] minutos",
    });
    return {
      "overridden key": i18n("one minute"),
      "overridden with interpolation": i18n("[x] minutes", { x: 2 }),
      "inherited key": i18n("one person"),
    };
  });

  // --- addAll / addLangKeys ---

  test("addAll registers multiple keys at once", () => {
    const i18n = createI18n({ systemLang: "fr" });
    i18n.addAll({
      "one minute": { fr: "une minute" },
      "one person": { fr: "une personne" },
    });
    return {
      minute: i18n("one minute"),
      person: i18n("one person"),
    };
  });

  test("addLangKeys is accumulative across multiple calls", () => {
    const i18n = createI18n({ systemLang: "fr" });
    i18n.addLangKeys("fr", { "one minute": "une minute" });
    i18n.addLangKeys("fr", { "one person": "une personne" });
    return {
      minute: i18n("one minute"),
      person: i18n("one person"),
    };
  });

  test("activeLang updated when a matching lang is registered after creation", () => {
    const i18n = createI18n({ systemLang: "fr" });
    const before = i18n("one minute");
    i18n.add("one minute", { fr: "une minute" });
    const after = i18n("one minute");
    return { before, after };
  });
});
