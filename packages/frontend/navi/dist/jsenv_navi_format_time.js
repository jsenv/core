import { parseDuration } from "@jsenv/validity";

// The JSX half of interpolation (VNode detection, fragment assembly) is
// installed by interpolate.jsx rather than imported: this module sits under
// createI18n and the pure formatters (format_time.js), which must stay
// importable where preact is not installed. Until installed, a VNode
// replacement is neither detected nor assembled — values are joined as
// strings — which is only reachable by passing a VNode without going through
// <Interpolate>.

/**
 * Interpolates a template string, replacing `[key]` placeholders with values.
 *
 * Usable on its own — no i18n instance required — whenever a sentence should
 * stay readable as one string instead of being cut into JSX expressions or
 * concatenations. `<Interpolate>` is the JSX form of this function, and
 * `createI18n` runs every translation through it. See `docs/i18n.md`.
 *
 * `[]` was chosen as the placeholder delimiter (rather than `{}` or `{{}}`)
 * because it does not conflict with JSX syntax, JavaScript template literals,
 * or common punctuation in translated strings.
 *
 * @param {string} template
 *   e.g. `"Hello [name], you have [count] messages"`. A non-string is returned
 *   untouched, as is any template when `replacements` is missing.
 * @param {object} [replacements]
 *   Values keyed by placeholder name. A key can be:
 *   - a direct name — `[name]` ← `{ name: "Alice" }`
 *   - a dot-path — `[item.label]` ← `{ item: { label: "Book" } }` (a literal
 *     `"item.label"` key wins over the path)
 *
 *   A value that is a function is called at that point, so an expensive or
 *   lazily-known replacement is only computed when the placeholder is actually
 *   present in this language's template.
 *
 *   A placeholder with no matching value is left in the output as-is
 *   (`"[name]"`), making the gap visible rather than silently empty.
 * @param {object} [options]
 * @param {boolean} [options.allowJsx=false]
 *   Allow VNode replacements (what `<Interpolate>` passes). Without it, a VNode
 *   value warns and is coerced to a string.
 * @returns {string|import("preact").VNode}
 *   A plain string when every replacement is a string, a Preact fragment when
 *   at least one VNode was interpolated with `allowJsx`.
 */
const interpolateText = (
  template,
  replacements,
  { allowJsx = false } = {},
) => {
  if (!replacements || typeof template !== "string") {
    return template;
  }
  const parts = template.split(/(\[[^\]]+\])/);
  const resolved = [];
  for (const part of parts) {
    const match = part.match(/^\[([^\]]+)\]$/);
    if (!match) {
      resolved.push(part);
      continue;
    }
    const key = match[1];
    let value = resolveValue(replacements, key, part);
    if (typeof value === "function") {
      value = value();
    }
    resolved.push(value);
  }
  {
    return resolved.join("");
  }
};

// Resolves a placeholder key against the replacements object.
// 1. Direct lookup: replacements["item.name"]
// 2. Dot-path lookup: replacements["item"]["name"]
// 3. Fallback: the original placeholder string (e.g. "[item.name]")
const resolveValue = (replacements, key, fallback) => {
  if (key in replacements) {
    return replacements[key];
  }
  const dotIndex = key.indexOf(".");
  if (dotIndex !== -1) {
    const head = key.slice(0, dotIndex);
    const tail = key.slice(dotIndex + 1);
    const parent = replacements[head];
    if (parent && typeof parent === "object") {
      const nested = parent[tail];
      if (nested !== undefined) {
        return nested;
      }
    }
  }
  return fallback;
};

/**
 * The language every formatter/i18n call falls back to when it is given no
 * `lang` — an injectable source, deliberately free of any import.
 *
 * This module is the seam that keeps text formatting importable outside the
 * browser (`@jsenv/navi/format_time` from a backend, say): by default the
 * source is the runtime's own locale, exactly what Intl itself would pick.
 * The browser bundle swaps the source for `languagesSignal` (see
 * lang_signal.js), so the fallback follows the user's live language
 * preference — and because the source is read fresh on every call, reading it
 * during a component render subscribes the component the same way reading the
 * signal directly would.
 */

let systemLocale;
let runtimeLangSource = () => {
  systemLocale ??= new Intl.DateTimeFormat().resolvedOptions().locale;
  return systemLocale;
};

const getRuntimeLang = () => runtimeLangSource();

/**
 * Creates a lightweight i18n instance: a central place where an app declares
 * its texts once and reads them back translated into the active language.
 *
 * Worth using even in a single-language app — one registry beats strings
 * scattered across components, and adding a second language later becomes a
 * data change instead of a refactor. See `docs/i18n.md` for how to choose
 * between the two key styles below and how this relates to `naviI18n`.
 *
 * @param {object} [options]
 * @param {string} [options.keyLang]
 *   When set, each key also serves as its own translation for `keyLang`.
 *   This allows writing keys directly in that language (typically the language
 *   the app is written in) so only *other* languages need registering:
 *
 *   ```js
 *   const i18n = createI18n({ keyLang: "en" });
 *   i18n.add("Hello [name]!", { fr: "Bonjour [name] !" });
 *   i18n("Hello [name]!", { name: "Alice" }, { lang: "en" }); // "Hello Alice!"
 *   i18n("Hello [name]!", { name: "Alice" }, { lang: "fr" }); // "Bonjour Alice !"
 *   ```
 *
 *   `keyLang` only applies to keys passed to `add()`/`addAll()`; a key never
 *   registered stays opaque and comes back as-is.
 *
 *   Without `keyLang`, keys are opaque identifiers and every language
 *   (including the one the app was written in) must be registered explicitly:
 *
 *   ```js
 *   const i18n = createI18n();
 *   i18n.add("greeting", { en: "Hello [name]!", fr: "Bonjour [name] !" });
 *   i18n("greeting", { name: "Alice" }, { lang: "en" }); // "Hello Alice!"
 *   ```
 *
 * @param {string} [options.fallbackLang]
 *   Language consulted when the active language has no translation for a key
 *   — per key, not per language: a partially translated language falls through
 *   to `fallbackLang` only for the keys it is missing. Without it, a missing
 *   translation returns the key itself.
 *
 * @param {string|string[]} [options.runtimeLang]
 *   The active language (BCP 47 tag or ordered array of tags) — named
 *   "runtime" rather than "system" because there is no actual access to the
 *   OS/user's system language from a browser, only `navigator.languages` (or
 *   an explicit override) at runtime. Defaults to the shared runtime language
 *   source (see runtime_lang.js) — `languagesSignal.value` in a browser
 *   bundle, the runtime's own locale elsewhere — read fresh on every
 *   `format()`/`has()` call (not frozen at creation time), so overriding the
 *   language app-wide via `setPreferredLanguage()`/`setSupportedLanguages()`
 *   (see lang_signal.js) is picked up here too.
 *   Passing an explicit `runtimeLang` opts out of that and stays fixed for
 *   this instance's whole lifetime.
 *
 * ---
 *
 * ## Registration
 *
 * **`i18n.add(key, { lang: "translation" })`** — one key, multiple languages.
 *
 * **`i18n.addAll({ key: { lang: "translation" }, ... })`** — multiple keys at once.
 *
 * **`i18n.addLangKeys(lang, { key: "translation", ... })`** — full language pack
 * (useful when loading a JSON translation file).
 *
 * All three accumulate: registering a key that already exists overwrites that
 * one key and leaves the rest of the language untouched. This is what lets an
 * app override a single built-in navi text without redeclaring the others.
 *
 * A regional variant (e.g. `"fr-CA"`) automatically inherits all keys from its
 * parent (`"fr"`) that it does not explicitly override:
 * ```js
 * i18n.addLangKeys("fr", { hello: "Bonjour !" });
 * i18n.addLangKeys("fr-CA", { hello: "Allo !" }); // other "fr" keys inherited
 * ```
 * Inheritance is resolved at registration time, so register the parent first.
 *
 * ---
 *
 * ## Reading
 *
 * **`i18n(key, values?, { lang? })`** — the translation for `key`, with
 * `[placeholder]` occurrences replaced from `values` (see `interpolateText`).
 * Returns `key` itself when nothing matches, so an untranslated string still
 * renders something readable. `i18n.format` is an alias of this call.
 *
 * **`i18n.has(key, { lang? })`** — whether a translation genuinely exists,
 * i.e. how to tell "no translation" apart from "translation equal to the key".
 *
 * @returns {Function & { add, addAll, addLangKeys, has, format, languageMap }}
 */
const createI18n = ({ keyLang, fallbackLang, runtimeLang } = {}) => {
  const languageMap = new Map();
  // Bumped by addLangKeys — the only thing besides the active lang itself
  // that could change what getActiveLang()/getResolvedFallbackLang() below
  // resolve to, so it's what invalidates their own small caches.
  let languageMapVersion = 0;

  // Without an explicit runtimeLang, the runtime language source is re-read
  // fresh on every call rather than frozen here — freezing it would silently
  // ignore setPreferredLanguage()/setSupportedLanguages() (see lang_signal.js)
  // for the rest of this instance's life.
  const hasExplicitRuntimeLang = runtimeLang !== undefined;

  // matchBestLang does real work (a Map lookup per candidate, a possible
  // "fr-CA" → "fr" split-and-retry loop) — worth skipping on every single
  // format()/has() call in the common case, since what it resolves to only
  // ever changes when languageMap itself changes (addLangKeys) or, for the
  // non-explicit case, when the runtime lang itself changes (preferred
  // language, supported languages, or "languagechange" — see lang_signal.js;
  // its languagesSignal is a computed() so its reference is stable when none
  // of its own dependencies actually changed, and the signal-free fallback is
  // a cached string) — comparing those two cheaply (===) is enough to know
  // the cached result below is still valid.
  let cachedActiveLang;
  let cachedActiveLangRuntimeLang;
  let cachedActiveLangVersion = -1;
  const getActiveLang = () => {
    const currentRuntimeLang = hasExplicitRuntimeLang
      ? runtimeLang
      : getRuntimeLang();
    if (
      cachedActiveLangVersion === languageMapVersion &&
      cachedActiveLangRuntimeLang === currentRuntimeLang
    ) {
      return cachedActiveLang;
    }
    cachedActiveLang = matchBestLang(currentRuntimeLang, languageMap);
    cachedActiveLangVersion = languageMapVersion;
    cachedActiveLangRuntimeLang = currentRuntimeLang;
    return cachedActiveLang;
  };

  // fallbackLang is a plain, never-reactive option set once at creation —
  // its own resolution only ever needs recomputing when languageMap does.
  let cachedResolvedFallbackLang;
  let cachedResolvedFallbackLangVersion = -1;
  const getResolvedFallbackLang = () => {
    if (!fallbackLang) {
      return null;
    }
    if (cachedResolvedFallbackLangVersion === languageMapVersion) {
      return cachedResolvedFallbackLang;
    }
    cachedResolvedFallbackLang = matchBestLang(fallbackLang, languageMap);
    cachedResolvedFallbackLangVersion = languageMapVersion;
    return cachedResolvedFallbackLang;
  };

  const addLangKeys = (lang, translations) => {
    // Accumulate: merge with any existing translations for this lang
    const existing = languageMap.get(lang);
    if (existing) {
      translations = { ...existing, ...translations };
    }
    // A regional variant inherits all keys not explicitly overridden
    // e.g. "fr-CA" inherits from "fr"
    const dashIndex = lang.indexOf("-");
    if (dashIndex !== -1) {
      const parentLang = lang.slice(0, dashIndex);
      const parentTranslations = languageMap.get(parentLang);
      if (parentTranslations) {
        translations = { ...parentTranslations, ...translations };
      }
    }
    languageMap.set(lang, translations);
    languageMapVersion++;
  };

  const add = (key, langTranslations) => {
    if (keyLang && !(keyLang in langTranslations)) {
      // Auto-register the key itself as the translation for keyLang
      addLangKeys(keyLang, { [key]: key });
    }
    for (const [lang, value] of Object.entries(langTranslations)) {
      addLangKeys(lang, { [key]: value });
    }
  };

  const addAll = (keyMap) => {
    for (const [key, langTranslations] of Object.entries(keyMap)) {
      add(key, langTranslations);
    }
  };

  const _getTemplate = (key, lang) => {
    // matchBestLang, not matchLang directly: lang can be an array (e.g.
    // languagesSignal.value is always an ordered array — see lang_signal.js) and
    // matchLang alone assumes a plain string, throwing
    // on .split() otherwise.
    const resolvedLang = lang ? matchBestLang(lang, languageMap) : null;
    if (resolvedLang) {
      const translations = languageMap.get(resolvedLang);
      const translated = translations[key];
      if (translated !== undefined) {
        return translated;
      }
    }
    const resolvedFallbackLang = getResolvedFallbackLang();
    if (resolvedFallbackLang) {
      const fallbackTranslations = languageMap.get(resolvedFallbackLang);
      const fallbackTranslated = fallbackTranslations[key];
      if (fallbackTranslated !== undefined) {
        return fallbackTranslated;
      }
    }
    // No translation found — return key as-is (opaque fallback)
    return key;
  };

  const format = (key, values, { lang = getActiveLang() } = {}) => {
    const template = _getTemplate(key, lang);
    return interpolateText(template, values);
  };

  const has = (key, { lang = getActiveLang() } = {}) => {
    const resolvedLang = lang ? matchBestLang(lang, languageMap) : null;
    if (resolvedLang) {
      const translations = languageMap.get(resolvedLang);
      if (translations && key in translations) {
        return true;
      }
    }
    const resolvedFallbackLang = getResolvedFallbackLang();
    if (resolvedFallbackLang) {
      const fallbackTranslations = languageMap.get(resolvedFallbackLang);
      if (fallbackTranslations && key in fallbackTranslations) {
        return true;
      }
    }
    return false;
  };

  // The i18n instance is itself a callable function
  const i18n = (key, values, opts) => format(key, values, opts);
  i18n.add = add;
  i18n.addAll = addAll;
  i18n.addLangKeys = addLangKeys;
  i18n.has = has;
  i18n.format = format;
  i18n.languageMap = languageMap;

  return i18n;
};

// Walk "fr-CA-variant" → "fr-CA" → "fr" until a registered lang is found
const matchLang = (lang, languageMap) => {
  if (languageMap.has(lang)) {
    return lang;
  }
  const parts = lang.split("-");
  while (parts.length > 1) {
    parts.pop();
    const candidate = parts.join("-");
    if (languageMap.has(candidate)) {
      return candidate;
    }
  }
  return null;
};

// lang can be a string or an ordered array of preference strings
const matchBestLang = (lang, languageMap) => {
  if (!lang) {
    return null;
  }
  const candidates = Array.isArray(lang) ? lang : [lang];
  for (const candidate of candidates) {
    const match = matchLang(candidate, languageMap);
    if (match) {
      return match;
    }
  }
  return null;
};

/**
 * The shared i18n instance holding every text @jsenv/navi components display
 * on their own — validation messages, button labels, empty-list messages,
 * relative time wording…
 *
 * It is navi's texts, not the application's: an app registers its own texts in
 * its own `createI18n()` instance and reaches for `naviI18n` only to change
 * what navi itself says, or to add a language navi does not ship. Keys here are
 * opaque identifiers (`"list.empty"`), never the English sentence — the
 * opposite of what an app is advised to do. `docs/i18n.md` explains why.
 *
 * The active language is read from `languagesSignal` (see lang_signal.js —
 * combines the browser's own `navigator.languages`, an optional
 * `setPreferredLanguage()` user override, and an optional
 * `setSupportedLanguages()` app-wide allow-list), live on every lookup.
 *
 * Built-in key namespaces, all overridable — the registrations below are the
 * exhaustive list, read them to find the exact key to override:
 *   - `"button.*"`     — Clear, Reset, Send, Open, Close, Cancel, Confirm…
 *   - `"time.*"`       — relative time wording, duration unit symbols, date field placeholders
 *   - `"spin.*"`       — the ends of a steppable range
 *   - `"list.*"`       — empty/no-match/failed-rows messages
 *   - `"badge_list.*"` — the "+[count] more" overflow badge
 *   - `"constraint.*"` — every field validation message
 *   - `"network_policy.*"` — what an action settles with when the policy kept it from the network
 *
 * Unit names get two derived keys, both optional: `<unit>__plural` and
 * `<unit>__short`. `<Unit>`/`<Quantity>` fall back to the singular when the
 * derived key is missing, and to `Intl.NumberFormat` when the unit itself is
 * not registered at all — so only units Intl gets wrong need registering.
 *
 * @example
 * import { naviI18n } from "@jsenv/navi";
 *
 * // Override a built-in text:
 * naviI18n.add("time.ongoing", { fr: "En cours…" });
 *
 * // Teach navi a language it does not ship:
 * naviI18n.addLangKeys("ja", { "list.empty": "項目がありません。" });
 *
 * // Register unit translations used by <Quantity>/<Unit>:
 * naviI18n.addAll({
 *   ticket:         { en: "ticket",  fr: "billet"  },
 *   ticket__plural: { en: "tickets", fr: "billets" },
 * });
 */
const naviI18n = createI18n();

naviI18n.addAll({
  "button.clear": {
    en: "Clear",
    fr: "Effacer",
  },
  "button.reset": {
    en: "Reset",
    fr: "Réinitialiser",
  },
  "button.send": {
    en: "Send",
    fr: "Envoyer",
  },
  "button.open": {
    en: "Open",
    fr: "Ouvrir",
  },
  "button.close": {
    en: "Close",
    fr: "Fermer",
  },
  "button.cancel": {
    en: "Cancel",
    fr: "Annuler",
  },
  "button.define": {
    en: "Define",
    fr: "Définir",
  },
  "button.confirm": {
    en: "Confirm",
    fr: "Confirmer",
  },
  "confirm.message": {
    en: "Are you sure you want to do this?",
    fr: "Êtes-vous sûr de vouloir faire cette action ?",
  },
  "button.more_actions": {
    en: "More actions",
    fr: "Autres actions",
  },
  "button.remove": {
    en: "Remove",
    fr: "Retirer",
  },
});

// Default built-in translations — apps can override any key via add()
naviI18n.addAll({
  "time.less_than_minute": {
    en: "in less than a minute",
    fr: "dans moins d'une minute",
    de: "in weniger als einer Minute",
    es: "en menos de un minuto",
    it: "in meno di un minuto",
    pt: "em menos de um minuto",
    nl: "over minder dan een minuut",
  },
  "time.ongoing": {
    en: "Ongoing",
    fr: "En cours",
    de: "Laufend",
    es: "En curso",
    it: "In corso",
    pt: "Em andamento",
    nl: "Bezig",
  },
  // [day] and [time] are replaced at runtime with the localized day/time strings
  "time.tomorrow_at": {
    en: "[day] at [time]",
    fr: "[day] à [time]",
    de: "[day] um [time]",
    es: "[day] a las [time]",
    it: "[day] alle [time]",
    pt: "[day] às [time]",
    nl: "[day] om [time]",
  },
  // [duration] is replaced at runtime with the formatted duration string (e.g. "1h30", "45 min")
  "time.in_duration": {
    en: "in [duration]",
    fr: "dans [duration]",
    de: "in [duration]",
    es: "en [duration]",
    it: "tra [duration]",
    pt: "em [duration]",
    nl: "over [duration]",
  },
  // Substituted in place of the "0 heure(s)" part of an Intl-generated
  // duration string when <Time type="time" format="long"> renders midnight
  // — see time.jsx's own TimeTime for why midnight can't just fall through
  // to formatMinuteDuration like every other hour does, and how this word
  // gets spliced in (formatToParts, not string concatenation) so the rest
  // of the sentence (conjunction, minutes) still comes out in whatever
  // grammar/word order this language's own Intl.DurationFormat produces.
  // Languages without an entry here fall back to that language's own
  // literal "0 heure(s)" wording instead (see TimeTime), never to this key.
  "time.midnight": {
    en: "midnight",
    fr: "minuit",
    de: "Mitternacht",
    es: "medianoche",
    it: "mezzanotte",
    pt: "meia-noite",
    nl: "middernacht",
  },
  // What <TimeRange> writes between the two bounds of a span — "8h–10h",
  // "11 mai – 14 mai". An en dash, the mark for a span, not a hyphen.
  "time.range_separator": {
    en: "–",
    fr: "–",
    de: "–",
    es: "–",
    it: "–",
    pt: "–",
    nl: "–",
  },
  // Compact duration unit symbols used in "1h30", "45min", "2d", etc.
  "time.duration.year_symbol": {
    en: "y",
    fr: "a",
    de: "J",
    es: "a",
    it: "a",
    pt: "a",
    nl: "j",
    ja: "年",
    zh: "年",
    ko: "년",
  },
  "time.duration.month_symbol": {
    en: "mo",
    fr: "mo",
    de: "Mo",
    es: "mo",
    it: "mo",
    pt: "mo",
    nl: "mo",
    ja: "月",
    zh: "月",
    ko: "월",
  },
  "time.duration.week_symbol": {
    en: "w",
    fr: "sem",
    de: "W",
    es: "sem",
    it: "sett",
    pt: "sem",
    nl: "w",
    ja: "週",
    zh: "周",
    ko: "주",
  },
  "time.duration.day_symbol": {
    en: "d",
    fr: "j",
    de: "T",
    es: "d",
    it: "g",
    pt: "d",
    nl: "d",
    ja: "日",
    zh: "天",
    ko: "일",
  },
  "time.duration.hour_symbol": {
    en: "h",
    fr: "h",
    de: "h",
    es: "h",
    it: "h",
    pt: "h",
    nl: "u",
    ja: "時間",
    zh: "小时",
    ko: "시간",
  },
  "time.duration.minute_symbol": {
    en: "min",
    fr: "min",
    de: "min",
    es: "min",
    it: "min",
    pt: "min",
    nl: "min",
    ja: "分",
    zh: "分",
    ko: "분",
  },
  "time.duration.second_symbol": {
    en: "s",
    fr: "s",
    de: "s",
    es: "s",
    it: "s",
    pt: "s",
    nl: "s",
    ja: "秒",
    zh: "秒",
    ko: "초",
  },
  "time.duration.millisecond_symbol": {
    en: "ms",
    fr: "ms",
    de: "ms",
    es: "ms",
    it: "ms",
    pt: "ms",
    nl: "ms",
    ja: "ms",
    zh: "ms",
    ko: "ms",
  },
});

// Spin messages — the ends of what one steps through, said without naming
// what it is made of: the same words fit days, months, pages or sizes.
naviI18n.addAll({
  "spin.previous": {
    en: "Previous",
    fr: "Précédent",
  },
  "spin.next": {
    en: "Next",
    fr: "Suivant",
  },
  "spin.nothing_before": {
    en: "No item before this one.",
    fr: "Pas d'élément avant celui-ci.",
  },
  "spin.nothing_after": {
    en: "No item after this one.",
    fr: "Pas d'élément après celui-ci.",
  },
});

// Time spin messages — what a clock writes between an hour and its minutes,
// and how the two ends of a span are named.
naviI18n.addAll({
  "time.hour_separator": {
    en: ":",
    fr: "h",
  },
  "time.hour_label": {
    en: "Hours",
    fr: "Heures",
  },
  "time.minute_label": {
    en: "Minutes",
    fr: "Minutes",
  },
  "time_range.from": {
    en: "From",
    fr: "De",
  },
  "time_range.to": {
    en: "to",
    fr: "à",
  },
});

// List messages — override any key to customize list messages
naviI18n.addAll({
  "list.empty": {
    en: "No items in this list.",
    fr: "Aucun élément dans cette liste.",
  },
  "list.no_match": {
    en: "No item matches this search.",
    fr: "Aucun élément ne correspond à cette recherche.",
  },
  "list.no_match_rest_shown": {
    en: "No item matches this search. The rest is shown below.",
    fr: "Aucun élément ne correspond à cette recherche. Le reste est affiché ci-dessous.",
  },
  "list.rows_failed": {
    en: "These elements could not be loaded.",
    fr: "Ces élements n'ont pas pu être chargées.",
  },
  "list.rows_retry": {
    en: "Retry",
    fr: "Réessayer",
  },
});

// Badge list messages
naviI18n.addAll({
  "badge_list.more": {
    en: "+[count] more",
    fr: "+[count] de plus",
  },
});

// Constraint validation messages — override any key to customize error messages
naviI18n.addAll({
  "constraint.available": {
    fr: '"[value]" est utilisé. Veuillez entrer une autre valeur.',
    en: '"[value]" is already taken. Please enter a different value.',
  },
  "constraint.required.date": {
    fr: "Veuillez sélectionner une date.",
    en: "Please select a date.",
  },
  "constraint.required.month": {
    fr: "Veuillez sélectionner un mois.",
    en: "Please select a month.",
  },
  "constraint.required.week": {
    fr: "Veuillez sélectionner une semaine.",
    en: "Please select a week.",
  },
  "constraint.required.time": {
    fr: "Veuillez sélectionner une heure.",
    en: "Please select a time.",
  },
  "constraint.required.number": {
    fr: "Veuillez saisir un nombre.",
    en: "Please enter a number.",
  },
  "constraint.required.datetime": {
    fr: "Veuillez sélectionner une date et une heure.",
    en: "Please select a date and time.",
  },
  "constraint.required.color": {
    fr: "Veuillez sélectionner une couleur.",
    en: "Please select a color.",
  },
  "constraint.required.file": {
    fr: "Veuillez sélectionner un fichier.",
    en: "Please select a file.",
  },
  "constraint.required.file.multiple": {
    fr: "Veuillez sélectionner au moins un fichier.",
    en: "Please select at least one file.",
  },
  "constraint.disabled.checkbox": {
    fr: "Cette case est désactivée.",
    en: "This checkbox is disabled.",
  },
  "constraint.disabled.radio": {
    fr: "Cette option est désactivée.",
    en: "This option is disabled.",
  },
  "constraint.disabled.default": {
    fr: "Ce champ est désactivé.",
    en: "This field is disabled.",
  },
  "constraint.readonly.button": {
    fr: "Cette action n'est pas disponible pour l'instant.",
    en: "This action is not available right now.",
  },
  "constraint.readonly.option": {
    fr: "Cette option n'est pas disponible.",
    en: "This option is not available.",
  },
  "constraint.readonly.selection": {
    fr: "La sélection ne peut plus être modifiée.",
    en: "This selection cannot be changed.",
  },
  "constraint.readonly.choice": {
    fr: "Ce choix ne peut plus être changé.",
    en: "This choice cannot be changed.",
  },
  "constraint.readonly.item": {
    fr: "Cet élément n'est pas disponible.",
    en: "This item is not available.",
  },
  "constraint.readonly.default": {
    fr: "Cet élément est en lecture seule et ne peut pas être modifié.",
    en: "This element is read-only and cannot be modified.",
  },
  "constraint.readonly.awaiting_change": {
    fr: "Cette action attend une modification.",
    en: "This action is waiting for a change.",
  },
  // parallelGuard: the surface already has as many runs in flight as it allows
  "constraint.readonly.parallel_guard": {
    fr: "[max] action[s] déjà en cours, attendez qu'une se termine.",
    en: "[max] action[s] already in progress, wait for one to finish.",
  },
  "constraint.readonly.network_policy": {
    fr: "Hors ligne : ça ne peut pas partir.",
    en: "Offline: this cannot be sent.",
  },
  "network_policy.offline": {
    fr: "Hors ligne : rien n'a été demandé.",
    en: "Offline: nothing was requested.",
  },
  "constraint.busy.button": {
    fr: "Cette action est en cours...",
    en: "This action is in progress...",
  },
  // What a ROW is waiting on: the row as a thing the list holds, joining it,
  // leaving it or being saved. Said "à la liste" / "to the list" on purpose —
  // in a selectable list, "en cours d'ajout" alone reads as "being added to
  // the selection", which is the sentence below and a different event.
  "constraint.busy.item": {
    fr: "Cet élément est en cours de synchronisation.",
    en: "This item is being synchronized.",
  },
  "constraint.busy.item.adding": {
    fr: "Cet élément est en cours d'ajout à la liste.",
    en: "This item is being added to the list.",
  },
  "constraint.busy.item.removing": {
    fr: "Cet élément est en cours de retrait de la liste.",
    en: "This item is being removed from the list.",
  },
  "constraint.busy.item.updating": {
    fr: "Cet élément est en cours de mise à jour.",
    en: "This item is being updated.",
  },
  // What the LIST is waiting on: the choice just made, on its way. The subject
  // is the selection, never a row — the row this is shown on is the one the
  // user just pressed, which is not the one being committed.
  "constraint.busy.selection": {
    fr: "La sélection est en cours d'enregistrement...",
    en: "This selection is being saved...",
  },
  "constraint.busy.choice": {
    fr: "Le choix est en cours d'enregistrement...",
    en: "This choice is being saved...",
  },
  "constraint.busy.default": {
    fr: "Cet élément est occupé.",
    en: "This element is busy.",
  },
  "constraint.one_of.no_match": {
    fr: "Aucune suggestion ne correspond à votre saisie.",
    en: "No suggestion matches your input.",
  },
  "constraint.one_of.default": {
    fr: "Veuillez choisir une valeur parmi les suggestions.",
    en: "Please choose a value from the suggestions.",
  },
  "constraint.same_as.password": {
    fr: "Ce mot de passe doit être identique au précédent.",
    en: "This password must match the previous one.",
  },
  "constraint.same_as.email": {
    fr: "Cette adresse e-mail doit être identique a la précédente.",
    en: "This email address must match the previous one.",
  },
  "constraint.same_as.default": {
    fr: "Ce champ doit être identique au précédent.",
    en: "This field must match the previous one.",
  },
  "constraint.time_after.default": {
    fr: "L'heure de fin ne peut pas être avant l'heure de début.",
    en: "The end time cannot be before the start time.",
  },
  "constraint.time_after.min_duration": {
    fr: "La plage doit durer au moins <strong>[duration]</strong> minutes.",
    en: "The span must last at least <strong>[duration]</strong> minutes.",
  },
  "constraint.required.checkbox": {
    fr: "Veuillez cocher cette case.",
    en: "Please check this box.",
  },
  "constraint.required.checkbox_group": {
    fr: "Veuillez sélectionner au moins une option.",
    en: "Please select at least one option.",
  },
  "constraint.required.radio": {
    fr: "Veuillez sélectionner une option.",
    en: "Please select an option.",
  },
  "constraint.required.password": {
    fr: "Veuillez saisir un mot de passe.",
    en: "Please enter a password.",
  },
  "constraint.required.password.confirm": {
    fr: "Veuillez confirmer le mot de passe.",
    en: "Please confirm the password.",
  },
  "constraint.required.email": {
    fr: "Veuillez saisir une adresse e-mail.",
    en: "Please enter an email address.",
  },
  "constraint.required.email.confirm": {
    fr: "Veuillez confirmer l'adresse e-mail.",
    en: "Please confirm the email address.",
  },
  "constraint.required.confirm": {
    fr: "Veuillez confirmer le champ précédent.",
    en: "Please confirm the previous field.",
  },
  "constraint.required.default": {
    fr: "Veuillez remplir ce champ.",
    en: "Please fill in this field.",
  },
  "constraint.pattern.password": {
    fr: "Ce mot de passe ne correspond pas au format requis.",
    en: "This password does not match the required format.",
  },
  "constraint.pattern.email": {
    fr: "Cette adresse e-mail ne correspond pas au format requis.",
    en: "This email address does not match the required format.",
  },
  "constraint.pattern.default": {
    fr: "Ce champ ne correspond pas au format requis.",
    en: "This field does not match the required format.",
  },
  "constraint.type.email.at": {
    fr: 'Veuillez inclure "@" dans l\'adresse e-mail. Il manque un symbole "@" dans [value].',
    en: 'Please include "@" in the email address. "@" is missing in [value].',
  },
  "constraint.type.email.invalid": {
    fr: "Veuillez saisir une adresse e-mail valide.",
    en: "Please enter a valid email address.",
  },
  "constraint.min_length.singular.password": {
    fr: "Ce mot de passe doit contenir au moins [min] caractère (il contient actuellement un seul caractère).",
    en: "This password must contain at least [min] character (it currently contains only one character).",
  },
  "constraint.min_length.singular.email": {
    fr: "Cette adresse e-mail doit contenir au moins [min] caractère (il contient actuellement un seul caractère).",
    en: "This email address must contain at least [min] character (it currently contains only one character).",
  },
  "constraint.min_length.singular.default": {
    fr: "Ce champ doit contenir au moins [min] caractère (il contient actuellement un seul caractère).",
    en: "This field must contain at least [min] character (it currently contains only one character).",
  },
  "constraint.min_length.plural.password": {
    fr: "Ce mot de passe doit contenir au moins [min] caractères (il contient actuellement [count] caractères).",
    en: "This password must contain at least [min] characters (it currently contains [count] characters).",
  },
  "constraint.min_length.plural.email": {
    fr: "Cette adresse e-mail doit contenir au moins [min] caractères (il contient actuellement [count] caractères).",
    en: "This email address must contain at least [min] characters (it currently contains [count] characters).",
  },
  "constraint.min_length.plural.default": {
    fr: "Ce champ doit contenir au moins [min] caractères (il contient actuellement [count] caractères).",
    en: "This field must contain at least [min] characters (it currently contains [count] characters).",
  },
  "constraint.max_length.password": {
    fr: "Ce mot de passe doit contenir au maximum [max] caractères (il contient actuellement [count] caractères).",
    en: "This password must contain at most [max] characters (it currently contains [count] characters).",
  },
  "constraint.max_length.email": {
    fr: "Cette adresse e-mail doit contenir au maximum [max] caractères (il contient actuellement [count] caractères).",
    en: "This email address must contain at most [max] characters (it currently contains [count] characters).",
  },
  "constraint.max_length.default": {
    fr: "Ce champ doit contenir au maximum [max] caractères (il contient actuellement [count] caractères).",
    en: "This field must contain at most [max] characters (it currently contains [count] characters).",
  },
  "constraint.max_length.selection": {
    fr: "Sélectionnez au maximum [max] choix ([count] actuellement).",
    en: "Select at most [max] choices ([count] currently).",
  },
  "constraint.type.number.default": {
    fr: "Ce champ doit être un nombre.",
    en: "This field must be a number.",
  },
  "constraint.type.hour.default": {
    fr: "Ce champ doit contenir un nombre d'heures.",
    en: "This field must contain a number of hours.",
  },
  "constraint.type.minute.default": {
    fr: "Ce champ doit contenir un nombre de minutes.",
    en: "This field must contain a number of minutes.",
  },
  "constraint.type.second.default": {
    fr: "Ce champ doit contenir un nombre de secondes.",
    en: "This field must contain a number of seconds.",
  },
  "constraint.type.percentage.default": {
    fr: "Ce champ doit contenir un pourcentage.",
    en: "This field must contain a percentage.",
  },
  "constraint.min.number.default": {
    fr: "Ce nombre doit être <strong>[min]</strong> ou plus.",
    en: "This number must be <strong>[min]</strong> or greater.",
  },
  "constraint.min.hour.default": {
    fr: "Le nombre d'heures doit être <strong>[min]</strong> ou plus.",
    en: "The number of hours must be <strong>[min]</strong> or greater.",
  },
  "constraint.min.minute.default": {
    fr: "Le nombre de minutes doit être <strong>[min]</strong> ou plus.",
    en: "The number of minutes must be <strong>[min]</strong> or greater.",
  },
  "constraint.min.second.default": {
    fr: "Le nombre de secondes doit être <strong>[min]</strong> ou plus.",
    en: "The number of seconds must be <strong>[min]</strong> or greater.",
  },
  "constraint.min.percentage.default": {
    fr: "Le pourcentage doit être <strong>[min]</strong> ou plus.",
    en: "The percentage must be <strong>[min]</strong> or greater.",
  },
  "constraint.min.duration.default": {
    fr: "La durée doit être d'au moins <strong>[min]</strong>.",
    en: "The duration must be at least <strong>[min]</strong>.",
  },
  "constraint.max.duration.default": {
    fr: "La durée ne doit pas dépasser <strong>[max]</strong>.",
    en: "The duration must not exceed <strong>[max]</strong>.",
  },
  "constraint.step.duration.default": {
    fr: "La durée doit être un multiple de <strong>[step]</strong> (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "The duration must be a multiple of <strong>[step]</strong> (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.min.time.default": {
    fr: "L'heure doit être <strong>[min]</strong> ou plus.",
    en: "The time must be <strong>[min]</strong> or later.",
  },
  "constraint.min.date.today.default": {
    fr: "La date doit être aujourd'hui ou dans le futur.",
    en: "The date must be today or in the future.",
  },
  "constraint.min.date.default": {
    fr: "La date doit être à partir du <strong>[min]</strong>.",
    en: "The date must be on or after <strong>[min]</strong>.",
  },
  "constraint.max.date.today.default": {
    fr: "La date doit être aujourd'hui ou dans le passé.",
    en: "The date must be today or in the past.",
  },
  "constraint.max.date.default": {
    fr: "La date doit être au plus tard le <strong>[max]</strong>.",
    en: "The date must be on or before <strong>[max]</strong>.",
  },
  "constraint.max.number.default": {
    fr: "Max <strong>[max]</strong>.",
    en: "Max <strong>[max]</strong>.",
  },
  "constraint.max.hour.default": {
    fr: "Max <strong>[max]</strong> heures.",
    en: "Max <strong>[max]</strong> hours.",
  },
  "constraint.max.minute.default": {
    fr: "Max <strong>[max]</strong> minutes.",
    en: "Max <strong>[max]</strong> minutes.",
  },
  "constraint.max.second.default": {
    fr: "Max <strong>[max]</strong> secondes.",
    en: "Max <strong>[max]</strong> secondes.",
  },
  "constraint.max.percentage.default": {
    fr: "Max <strong>[max]</strong>%.",
    en: "Max <strong>[max]</strong>%.",
  },
  "constraint.step.number.default": {
    fr: "Ce nombre doit être un multiple de <strong>[step]</strong> (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "This number must be a multiple of <strong>[step]</strong> (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.step.hour.default": {
    fr: "Le nombre d'heures doit être un multiple de <strong>[step]</strong> (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "The number of hours must be a multiple of <strong>[step]</strong> (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.step.minute.default": {
    fr: "Le nombre de minutes doit être un multiple de <strong>[step]</strong> (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "The number of minutes must be a multiple of <strong>[step]</strong> (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.step.second.default": {
    fr: "Le nombre de secondes doit être un multiple de <strong>[step]</strong> (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "The number of seconds must be a multiple of <strong>[step]</strong> (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.step.percentage.default": {
    fr: "Le pourcentage doit être un multiple de <strong>[step]</strong> (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "The percentage must be a multiple of <strong>[step]</strong> (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.step.time.hour": {
    fr: "L'heure doit être dans un intervalle de <strong>[step]</strong> heure(s) (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "The time must be within an interval of <strong>[step]</strong> hour(s) (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.step.time.minute": {
    fr: "L'heure doit être dans un intervalle de <strong>[step]</strong> minute(s) (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "The time must be within an interval of <strong>[step]</strong> minute(s) (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.step.time.second": {
    fr: "L'heure doit être dans un intervalle de <strong>[step]</strong> seconde(s) (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "The time must be within an interval of <strong>[step]</strong> second(s) (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.step.date.default": {
    fr: "La date doit correspondre à un intervalle de <strong>[step]</strong> jour(s) (par ex. <strong>[before]</strong> ou <strong>[after]</strong>).",
    en: "The date must correspond to an interval of <strong>[step]</strong> day(s) (e.g. <strong>[before]</strong> or <strong>[after]</strong>).",
  },
  "constraint.max.time.default": {
    fr: "L'heure doit être <strong>[max]</strong> ou moins.",
    en: "The time must be <strong>[max]</strong> or earlier.",
  },
  "constraint.single_space.start": {
    fr: "Ce champ ne doit pas commencer par un espace.",
    en: "This field must not start with a space.",
  },
  "constraint.single_space.end": {
    fr: "Ce champ ne doit pas finir par un espace.",
    en: "This field must not end with a space.",
  },
  "constraint.single_space.consecutive": {
    fr: "Ce champ ne doit pas contenir plusieurs espaces consécutifs.",
    en: "This field must not contain consecutive spaces.",
  },
  // [sample] is the offending character with its marks — a stack is invisible
  // as a description and obvious as a sample.
  "constraint.displayable.stacked_marks.singular": {
    fr: "Ce champ contient un caractère qui empile plus de <strong>[max]</strong> signes : « [sample] ».",
    en: "This field contains a character stacking more than <strong>[max]</strong> marks: “[sample]”.",
  },
  "constraint.displayable.stacked_marks.plural": {
    fr: "Ce champ contient [count] caractères qui empilent plus de <strong>[max]</strong> signes (tel que « [sample] »).",
    en: "This field contains [count] characters stacking more than <strong>[max]</strong> marks (such as “[sample]”).",
  },
  "constraint.displayable.invisible": {
    fr: "Ce champ doit contenir au moins un caractère visible.",
    en: "This field must contain at least one visible character.",
  },
  "constraint.displayable.blank_lines": {
    fr: "Ce champ ne doit pas contenir plusieurs lignes vides consécutives.",
    en: "This field must not contain consecutive blank lines.",
  },
  "constraint.displayable.dangling_joiner": {
    fr: "Ce champ contient un caractère de liaison invisible qui ne relie rien.",
    en: "This field contains an invisible joiner that joins nothing.",
  },
  "constraint.no_emoji.default": {
    fr: "Ce champ ne doit pas contenir d'emoji.",
    en: "This field must not contain emoji.",
  },
  "constraint.max_line_breaks.default": {
    fr: "Ce champ ne doit pas contenir plus de [max] retour[s] à la ligne.",
    en: "This field must not contain more than [max] line break[s].",
  },
  "constraint.min_lower_letter.password.singular": {
    fr: "Ce mot de passe doit contenir au moins une lettre minuscule.",
    en: "This password must contain at least one lowercase letter.",
  },
  "constraint.min_lower_letter.password.plural": {
    fr: "Ce mot de passe doit contenir au moins [min] lettres minuscules.",
    en: "This password must contain at least [min] lowercase letters.",
  },
  "constraint.min_lower_letter.default.singular": {
    fr: "Ce champ doit contenir au moins une lettre minuscule.",
    en: "This field must contain at least one lowercase letter.",
  },
  "constraint.min_lower_letter.default.plural": {
    fr: "Ce champ doit contenir au moins [min] lettres minuscules.",
    en: "This field must contain at least [min] lowercase letters.",
  },
  "constraint.min_upper_letter.password.singular": {
    fr: "Ce mot de passe doit contenir au moins une lettre majuscule.",
    en: "This password must contain at least one uppercase letter.",
  },
  "constraint.min_upper_letter.password.plural": {
    fr: "Ce mot de passe doit contenir au moins [min] lettres majuscules.",
    en: "This password must contain at least [min] uppercase letters.",
  },
  "constraint.min_upper_letter.default.singular": {
    fr: "Ce champ doit contenir au moins une lettre majuscule.",
    en: "This field must contain at least one uppercase letter.",
  },
  "constraint.min_upper_letter.default.plural": {
    fr: "Ce champ doit contenir au moins [min] lettres majuscules.",
    en: "This field must contain at least [min] uppercase letters.",
  },
  "constraint.min_digit.password.singular": {
    fr: "Ce mot de passe doit contenir au moins un chiffre.",
    en: "This password must contain at least one digit.",
  },
  "constraint.min_digit.password.plural": {
    fr: "Ce mot de passe doit contenir au moins [min] chiffres.",
    en: "This password must contain at least [min] digits.",
  },
  "constraint.min_digit.default.singular": {
    fr: "Ce champ doit contenir au moins un chiffre.",
    en: "This field must contain at least one digit.",
  },
  "constraint.min_digit.default.plural": {
    fr: "Ce champ doit contenir au moins [min] chiffres.",
    en: "This field must contain at least [min] digits.",
  },
  "constraint.min_special_char.password.singular": {
    fr: "Ce mot de passe doit contenir au moins un caractère spécial. ([charset])",
    en: "This password must contain at least one special character. ([charset])",
  },
  "constraint.min_special_char.password.plural": {
    fr: "Ce mot de passe doit contenir au moins [min] caractères spéciaux. ([charset])",
    en: "This password must contain at least [min] special characters. ([charset])",
  },
  "constraint.min_special_char.default.singular": {
    fr: "Ce champ doit contenir au moins un caractère spécial. ([charset])",
    en: "This field must contain at least one special character. ([charset])",
  },
  "constraint.min_special_char.default.plural": {
    fr: "Ce champ doit contenir au moins [min] caractères spéciaux. ([charset])",
    en: "This field must contain at least [min] special characters. ([charset])",
  },
});

// Character class and maxLengthGuard messages. The char class keys are
// @jsenv/validity's own ("char_class.slug"), prefixed with "constraint." —
// the same sentence refuses a keystroke in a callout and a whole value in a
// constraint, so there is one key for both.
naviI18n.addAll({
  // Preset-specific char messages — more informative than the generic fallback
  "constraint.char_class.numeric": {
    fr: "Ce champ ne peut contenir que des chiffres.",
    en: "This field can only contain digits.",
  },
  "constraint.char_class.alpha": {
    fr: "Ce champ ne peut contenir que des lettres.",
    en: "This field can only contain letters.",
  },
  "constraint.char_class.alphanumeric": {
    fr: "Ce champ ne peut contenir que des lettres et des chiffres.",
    en: "This field can only contain letters and digits.",
  },
  "constraint.char_class.uppercase": {
    fr: "Ce champ ne peut contenir que des lettres majuscules.",
    en: "This field can only contain uppercase letters.",
  },
  "constraint.char_class.hex": {
    fr: "Ce champ ne peut contenir que des chiffres hexadécimaux (0-9, A-F).",
    en: "This field can only contain hexadecimal digits (0-9, A-F).",
  },
  "constraint.char_class.slug": {
    fr: "Ce champ ne peut contenir que des lettres minuscules, des chiffres et des tirets.",
    en: "This field can only contain lowercase letters, digits, and hyphens.",
  },
  // Generic fallback for custom char classes and other presets (tel, card, postal, iban…)
  "constraint.char_class.no_emoji": {
    fr: "Ce champ ne peut pas contenir d'emoji.",
    en: "This field cannot contain emoji.",
  },
  "constraint.char_class.default": {
    fr: "Ce champ ne peut contenir que les caractères autorisés.",
    en: "This field can only contain allowed characters.",
  },
  // maxLength: keydown blocked (one character would exceed the limit)
  "constraint.guard.max_length.typing": {
    fr: "Longueur maximale de [max] caractère[s] atteinte.",
    en: "Maximum length of [max] character[s] reached.",
  },
  // maxLength: paste/set truncated to maxLength (autofix always applied)
  "constraint.guard.max_length.value": {
    fr: "Ce champ ne peut pas contenir plus de [max] caractère[s], une partie a été tronquée.",
    en: "This field cannot contain more than [max] character[s]; the value was truncated.",
  },
  // maxLengthGuard on a multiple selection: one more item would exceed the limit
  "constraint.guard.max_length.selection": {
    fr: "[max] max.",
    en: "[max] max.",
  },
});

// Date/time placeholder tokens — shown when no value is selected
// Override any key to adapt to your language conventions
naviI18n.addAll({
  "time.placeholder.day": {
    fr: "jj",
    en: "dd",
    de: "TT",
    es: "dd",
    it: "gg",
    pt: "dd",
    nl: "dd",
  },
  "time.placeholder.month": {
    fr: "mm",
    en: "mm",
    de: "MM",
    es: "mm",
    it: "mm",
    pt: "mm",
    nl: "mm",
  },
  "time.placeholder.year": {
    fr: "aaaa",
    en: "yyyy",
    de: "JJJJ",
    es: "aaaa",
    it: "aaaa",
    pt: "aaaa",
    nl: "jjjj",
  },
  "time.placeholder.hour": {
    fr: "hh",
    en: "hh",
    de: "hh",
    es: "hh",
    it: "hh",
    pt: "hh",
    nl: "uu",
  },
  "time.placeholder.minute": {
    fr: "mm",
    en: "mm",
    de: "mm",
    es: "mm",
    it: "mm",
    pt: "mm",
    nl: "mm",
  },
  "time.placeholder.week": {
    fr: "sem.",
    en: "wk",
    de: "KW",
    es: "sem.",
    it: "sett.",
    pt: "sem.",
    nl: "wk",
  },
});

/**
 * Pure vanilla JS time formatting utilities, usable outside the browser.
 *
 * Exposed as `@jsenv/navi/format_time` so code that has no preact (a backend
 * writing dates into push notifications, say) shares the exact same wording
 * as the `<Time>` components. Everything this module imports must stay free
 * of preact/@preact/signals. `lang` defaults to the runtime language source
 * (see runtime_lang.js): `languagesSignal` in a browser bundle — live, and
 * subscribing a rendering component like any signal read — the runtime's own
 * locale elsewhere.
 *
 * All functions accept an optional `{ now }` parameter for testability.
 */


// Our own compact/custom duration notation interpolates raw numbers
// directly (unlike Intl.DurationFormat, which groups thousands on its own,
// e.g. "5 400 secondes") — this keeps that consistent without reimplementing
// locale-aware grouping. Falls back to the raw value as-is for a
// non-numeric mid-edit value (e.g. "2a"), which Intl.NumberFormat can't
// format anyway.
const formatCompactNumber = (value, lang) => {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat(lang).format(n) : value;
};

/**
 * Formats a date as a human-readable day string.
 *
 * @param {Date} date
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"numeric"|{ weekday?: "long"|"short"|"narrow", month?: "long"|"short"|"narrow"|"numeric" }, year?: boolean|"auto", now?: Date }} [options]
 *   A string spells the weekday and the month the same way. An object spells
 *   them apart, each key defaulting to `"long"`: a narrow card usually wants
 *   the weekday whole (it is the reading anchor) and the month abbreviated (it
 *   is where the characters are — "septembre" is 9 of them, "sept." reads the
 *   same). `"numeric"` stays a string-only spelling: it drops the weekday and
 *   writes the whole date in digits.
 * @param {boolean|"auto"} [options.year=true]
 *   Whether the `"numeric"` spelling writes the year: `false` drops it
 *   ("30/07", the day/month order still following the locale), `"auto"` drops
 *   it only when the date is in the current year (`now`'s year). The spelled
 *   formats never write the year, so they ignore it.
 *
 * @example
 * formatDay(new Date(), { lang: "fr" })                    // "lundi 11 mai" (long, default)
 * formatDay(new Date(), { lang: "fr", format: "short" })  // "lun. 11 mai"
 * formatDay(new Date(), { lang: "fr", format: "narrow" }) // "lu. 11 mai"
 * formatDay(new Date(), { lang: "fr", format: "numeric" }) // "11/05/2026"
 * formatDay(new Date(), { lang: "fr", format: "numeric", year: false }) // "11/05"
 * formatDay(new Date(), { lang: "fr", format: { weekday: "long", month: "short" } }) // "mercredi 2 sept."
 */
const formatDay = (
  date,
  {
    lang = getRuntimeLang(),
    format = "long",
    year = true,
    now = new Date(),
  } = {},
) => {
  if (format === "numeric") {
    const yearWritten =
      year === "auto"
        ? date.getFullYear() !== now.getFullYear()
        : year !== false;
    return new Intl.DateTimeFormat(lang, {
      day: "2-digit",
      month: "2-digit",
      ...(yearWritten ? { year: "numeric" } : {}),
    }).format(date);
  }
  const { weekday = "long", month = "long" } =
    typeof format === "string" ? { weekday: format, month: format } : format;
  return new Intl.DateTimeFormat(lang, {
    weekday, // "long", "short", or "narrow"
    day: "numeric",
    month,
  }).format(date);
};

/**
 * Returns the day offset relative to now: -1 (yesterday), 0 (today), 1 (tomorrow), or the
 * actual number of days difference for any other date.
 */
const getRelativeDay = (date, { now = new Date() } = {}) => {
  const dateKey = toLocalDayKey(date);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  if (dateKey === toLocalDayKey(yesterdayDate)) {
    return -1;
  }

  if (dateKey === toLocalDayKey(now)) {
    return 0;
  }

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (dateKey === toLocalDayKey(tomorrowDate)) {
    return 1;
  }

  const nowMidnight = new Date(now);
  nowMidnight.setHours(0, 0, 0, 0);
  const dateMidnight = new Date(date);
  dateMidnight.setHours(0, 0, 0, 0);
  return Math.round((dateMidnight - nowMidnight) / DAY);
};

/**
 * Formats a relative day offset (-1/0/1) as a locale-aware label: "hier", "aujourd'hui", "demain".
 */
// ── Placeholder helpers ────────────────────────────────────────────────────
// Derive locale-aware format placeholders from Intl.DateTimeFormat.formatToParts
// using a sentinel date whose parts are unambiguous (day=28, month=11, year=9999).
// Per-language token tables cover the most common locales; unknown langs fall
// back to "dd/mm/yyyy".

const SENTINEL_DATE = new Date(9999, 10, 28); // 28 Nov 9999 — day≠month, both 2-digit

const getToken = (key, lang) =>
  naviI18n(`time.placeholder.${key}`, undefined, { lang });

const formatDatePlaceholder = ({ lang = getRuntimeLang() } = {}) => {
  const parts = new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(SENTINEL_DATE);
  return parts
    .map((p) => {
      if (p.type === "day") {
        return getToken("day", lang);
      }
      if (p.type === "month") {
        return getToken("month", lang);
      }
      if (p.type === "year") {
        return getToken("year", lang);
      }
      return p.value;
    })
    .join("");
};

const formatMonthPlaceholder = ({
  lang = getRuntimeLang(),
  format = "long",
} = {}) => {
  const parts = new Intl.DateTimeFormat(lang, {
    month: format,
    year: "numeric",
  }).formatToParts(SENTINEL_DATE);
  return parts
    .map((p) => {
      if (p.type === "month") {
        // Text month formats (long/short/narrow) → dash; numeric → token
        return format === "numeric" ? "–" : getToken("month", lang);
      }
      if (p.type === "year") {
        return getToken("year", lang);
      }
      return p.value;
    })
    .join("");
};

const formatWeekPlaceholder = ({ lang = getRuntimeLang() } = {}) => {
  return `${getToken("week", lang)} xx / ${getToken(lang)}`;
};

const formatDatetimePlaceholder = ({
  lang = getRuntimeLang(),
  format = "long",
} = {}) => {
  const intlOptions =
    format === "long"
      ? {
          weekday: "short",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        }
      : format === "narrow"
        ? {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }
        : {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          };
  const parts = new Intl.DateTimeFormat(lang, intlOptions).formatToParts(
    SENTINEL_DATE,
  );
  let skipNext = false;
  return parts
    .map((p) => {
      if (p.type === "weekday") {
        skipNext = true;
        return "";
      }
      if (p.type === "literal" && skipNext) {
        skipNext = false;
        return "";
      }
      skipNext = false;
      if (p.type === "day") {
        return getToken("day", lang);
      }
      if (p.type === "month") {
        return getToken("month", lang);
      }
      if (p.type === "hour") {
        return getToken("hour", lang);
      }
      if (p.type === "minute") {
        return getToken("minute", lang);
      }
      return p.value;
    })
    .join("")
    .trim();
};

// ── End placeholder helpers ────────────────────────────────────────────────

const formatDayRelative = (offset, lang) => {
  const relativeDay = new Intl.RelativeTimeFormat(lang, {
    numeric: "auto",
  }).format(offset, "day");
  return relativeDay;
};

const formatMonth = (
  date,
  { lang = getRuntimeLang(), format = "long" } = {},
) => {
  return new Intl.DateTimeFormat(lang, {
    month: format, // "long", "short", or "narrow"
    year: "numeric",
  }).format(date);
};

/**
 * Formats a date as "lun. 11 mai, 14:30" (long), "11 mai, 14:30" (short), "11/05, 14:30" (narrow).
 */
const formatDatetime = (
  date,
  { lang = getRuntimeLang(), format = "long" } = {},
) => {
  if (format === "long") {
    return new Intl.DateTimeFormat(lang, {
      weekday: "short",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  if (format === "narrow") {
    return new Intl.DateTimeFormat(lang, {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }
  // "short": no weekday
  return new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/**
 * Formats a date as "14:30".
 */
const formatTime = (date, lang) => {
  return new Intl.DateTimeFormat(lang, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

/**
 * Formats a time-of-day the way `<Time type="time">` writes it, as a plain
 * string — for the places a component cannot go (a `title` attribute, a push
 * notification).
 *
 * @param {Date|number|string} value
 *   A Date, a ms timestamp, or an "HH:MM"/"HH:MM:SS" string. Only the clock
 *   time is read. A nullish value renders the "--:--" placeholder; an
 *   unparseable one is returned as-is, stringified.
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact"|"timestring", pad?: boolean, precision?: "hour"|"minute" }} [options]
 *   The options `<Time type="time">` takes: `"timestring"` is the clock
 *   "14:30"; the other formats write the time as a duration-shaped phrase —
 *   see {@link formatMinuteDuration}'s `clockStyle` for what `pad` and
 *   `precision` shape in `format="compact"`.
 *
 * @example
 * formatTimeOfDay(date, { lang: "fr" })                                  // "14 heures 30" (long, default)
 * formatTimeOfDay(date, { lang: "fr", format: "timestring" })            // "14:30"
 * formatTimeOfDay(date, { lang: "fr", format: "compact" })               // "14h30"
 * formatTimeOfDay(date, { lang: "fr", format: "compact", pad: false })   // "8h30", "8h"
 */
const formatTimeOfDay = (
  value,
  {
    lang = getRuntimeLang(),
    format = "long",
    pad = true,
    precision = pad ? "minute" : "hour",
  } = {},
) => {
  if (value === undefined || value === null) {
    return "--:--";
  }
  const date = toTimeOfDay(value);
  // toDate turns a non-finite number into an Invalid Date, which is an object
  if (!date || isNaN(date.getTime())) {
    return String(value);
  }
  if (format === "timestring") {
    return formatTime(date, lang);
  }
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  // clockStyle: this is always a time-of-day here, never a duration — keeps
  // a zero hour instead of dropping it (midnight would otherwise be
  // indistinguishable from an actual 5-minute duration), and in
  // format="compact" also zero-pads a single-digit hour so "5h30"/"0h05"
  // read as "05h30"/"00h05", closer to a "HH:MM" clock.
  if (date.getHours() !== 0 || format !== "long") {
    // At midnight, short/narrow/compact keep the "0 h"/"0h" hour part —
    // "0 h et 5 min"/"0h 5min"/"00h05" — rather than substituting a
    // translated "midnight" word, which would look out of place squeezed
    // into these otherwise terse, symbol-based formats.
    return formatMinuteDuration(totalMinutes, {
      lang,
      format,
      clockStyle: true,
      pad,
      precision,
    });
  }
  // Midnight (hour 0) at format="long" can't go through
  // formatMinuteDuration's own default zero-hour handling: it drops a
  // zero-valued unit entirely (by design — a real 5-minute duration should
  // print as "5 minutes", not "0 hours 5 minutes"), so "00:05" would
  // otherwise render identically to an actual 5-minute duration, silently
  // losing the fact that it's midnight. Every other hour keeps at least its
  // own "N hour(s)" wording as a hint that this is a time-of-day — only
  // hour 0 loses that hint entirely.
  const midnightWord = naviI18n("time.midnight", undefined, { lang });
  if (midnightWord === "time.midnight") {
    // No "midnight" translation registered for this language — fall back
    // to this language's own literal "0 heure(s)" wording instead (still
    // better than leaking the untranslated key, or substituting an
    // English word that wouldn't grammatically match the rest of the
    // sentence in whatever language this actually is).
    return formatMinuteDuration(totalMinutes, {
      lang,
      format,
      clockStyle: true,
    });
  }
  // Swap just the "0 heure(s)" part of the Intl-generated duration
  // string for the translated "midnight" word, keeping everything else
  // (the conjunction, the minutes part) exactly as Intl would produce
  // for this locale — formatToParts tags each token with the unit it
  // belongs to, so the swap doesn't need to know the locale's own
  // grammar/word order. Only ever one hour-tagged group per call
  // (hours is always 0 or absent here), but guarded anyway in case a
  // future Intl implementation ever splits it into more parts.
  const parts = new Intl.DurationFormat(lang, {
    style: "long",
    hoursDisplay: "always",
  }).formatToParts({ hours: 0, minutes: date.getMinutes() });
  let hourGroupReplaced = false;
  return parts
    .map((part) => {
      if (part.unit !== "hour") {
        return part.value;
      }
      if (hourGroupReplaced) {
        return "";
      }
      hourGroupReplaced = true;
      return midnightWord;
    })
    .join("");
};

/**
 * Formats a span between two times-of-day the way `<TimeRange>` writes it, as
 * a plain string — "8h–10h", "11h30–14h00", "14 heures 30 – 16 heures".
 *
 * Applies `<TimeRange>`'s shared-precision rule: the two bounds are written
 * to the same precision, decided by the pair — any bound with minutes gives
 * minutes to both, zero included ("11h30–14h00", never "11h30–14h").
 *
 * @param {Date|number|string} from
 * @param {Date|number|string} to
 *   Each bound accepts what {@link formatTimeOfDay} accepts; a nullish bound
 *   renders its "--:--" placeholder.
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact"|"timestring", pad?: boolean, precision?: "hour"|"minute", separator?: string }} [options]
 *   `precision` writes both bounds at this precision instead of the one the
 *   pair calls for. `separator` defaults to the `"time.range_separator"` navi
 *   text (an en dash), tightened against both bounds in `format="compact"` —
 *   where the span is one short token — and spaced out otherwise.
 *
 * @example
 * formatTimeRange("08:00", "10:00", { lang: "fr", format: "compact", pad: false }) // "8h–10h"
 * formatTimeRange("11:30", "14:00", { lang: "fr", format: "compact", pad: false }) // "11h30–14h00"
 */
const formatTimeRange = (
  from,
  to,
  {
    lang = getRuntimeLang(),
    format = "long",
    pad = true,
    precision = resolveTimeRangePrecision(from, to, { format, pad }),
    separator = naviI18n("time.range_separator", undefined, { lang }),
  } = {},
) => {
  const boundOptions = { lang, format, pad, precision };
  const fromText = formatTimeOfDay(from, boundOptions);
  const toText = formatTimeOfDay(to, boundOptions);
  if (format === "compact") {
    return `${fromText}${separator}${toText}`;
  }
  return `${fromText} ${separator} ${toText}`;
};

// The two bounds of a span are written to the same precision, decided by the
// pair: "8h–10h" as long as neither has minutes, "11h30–14h00" as soon as one
// of them does. Only ever a question for the unpadded compact clock — the
// padded one always writes "08h00", and the spelled-out formats name their
// units, leaving no shape for the eye to trip on.
const resolveTimeRangePrecision = (from, to, { format, pad }) => {
  if (pad || format !== "compact") {
    return "minute";
  }
  const hasMinutes = (value) => {
    const date = toTimeOfDay(value);
    return Boolean(date) && !isNaN(date.getTime()) && date.getMinutes() !== 0;
  };
  return hasMinutes(from) || hasMinutes(to) ? "minute" : "hour";
};

/**
 * Formats a duration expressed in minutes as a human-readable string.
 * "long", "short", "narrow" delegate to Intl.DurationFormat.
 * "compact" uses our own notation that omits the minute symbol when hours are present.
 *
 * @param {number} minutes
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", clockStyle?: boolean, pad?: boolean, precision?: "hour"|"minute", forceUnit?: boolean }} [options]
 * @param {boolean} [options.forceUnit=false] - Keep the value in minutes
 *   however big it gets ("2160 minutes" instead of "1 jour et 12 heures").
 *   Past 24 hours the default promotes to days, which reads better but hides
 *   the unit the caller works in.
 * @param {boolean} [options.clockStyle=false] - Set this when `minutes`
 *   represents a time-of-day rather than a real duration (used by
 *   `<Time type="time">`, see time.jsx's own TimeTime). A clock's "0" is a
 *   meaningful hour rather than "no hours": a zero-hours component is
 *   normally dropped entirely (a real 5-minute duration should print as
 *   "5 minutes", not "0 hours 5 minutes"); this keeps it instead (e.g.
 *   "0 h et 5 min"/"0h 5min"/"00h05") so midnight doesn't collapse to
 *   something indistinguishable from an actual 5-minute duration.
 *   Must not be set for plain duration formatting.
 * @param {boolean} [options.pad=true] - Zero-pad the hour to 2 digits
 *   ("08h30" rather than "8h30"). `clockStyle` + `format: "compact"` only.
 * @param {"hour"|"minute"} [options.precision="minute"] - Whether a zero
 *   minute is written: `"minute"` keeps it ("10h00"), `"hour"` drops it
 *   ("10h"). `clockStyle` + `format: "compact"` only.
 *
 *   These last two are the clock's two independent shape choices, and only
 *   `format: "compact"` has to make them — the spelled-out formats put their
 *   units in words, so "10 heures"/"10 h"/"10h" already reads as a time of
 *   day whatever the padding, and they always write the hour bare and drop a
 *   zero minute. Padded + minute ("08h00") is the column shape, where every
 *   row occupies the same width; bare + hour ("8h", "8h30") is the shape a
 *   person speaks. Bare + minute ("8h00") only ever makes sense next to a
 *   partner that has minutes of its own — see `<TimeRange>`, which is the
 *   only thing that asks for it.
 *
 * @example
 * formatMinuteDuration(90, { lang: "fr" })                       // "1 heure 30 minutes" (long, default)
 * formatMinuteDuration(90, { lang: "fr", format: "short" })     // "1 h et 30 min" (Intl short)
 * formatMinuteDuration(90, { lang: "fr", format: "narrow" })    // "1h 30min" (Intl narrow)
 * formatMinuteDuration(90, { lang: "fr", format: "compact" })   // "1h30" (custom, no minute symbol)
 * formatMinuteDuration(45, { lang: "en", format: "compact" })   // "45min"
 * formatMinuteDuration(5, { lang: "fr", format: "narrow", clockStyle: true }) // "0h 5min"
 * formatMinuteDuration(330, { lang: "fr", format: "compact", clockStyle: true }) // "05h30"
 * formatMinuteDuration(600, { lang: "fr", format: "compact", clockStyle: true }) // "10h00"
 * formatMinuteDuration(600, { lang: "fr", format: "compact", clockStyle: true, pad: false }) // "10h00"
 * formatMinuteDuration(600, { lang: "fr", format: "compact", clockStyle: true, pad: false, precision: "hour" }) // "10h"
 * formatMinuteDuration(510, { lang: "fr", format: "compact", clockStyle: true, pad: false, precision: "hour" }) // "8h30"
 * formatMinuteDuration(2160, { lang: "fr" })                     // "1 jour et 12 heures"
 * formatMinuteDuration(2160, { lang: "fr", forceUnit: true })    // "2 160 minutes"
 */
const formatMinuteDuration = (
  minutes,
  {
    lang = getRuntimeLang(),
    format = "long",
    clockStyle = false,
    pad = true,
    precision = "minute",
    forceUnit = false,
  } = {},
) => {
  if (minutes < 0) {
    // the d/h/m split below only holds for a positive value; formatting the
    // magnitude and putting the sign back is the only reading that works
    return `-${formatMinuteDuration(-minutes, { lang, format, clockStyle, pad, precision, forceUnit })}`;
  }
  if (forceUnit || (minutes === 0 && !clockStyle)) {
    // a zero has nothing to promote to, and rendering it as an empty string
    // would be indistinguishable from a missing value
    return formatSingleUnit(minutes, "minute", { lang, format });
  }
  const totalHours = Math.floor(minutes / 60);
  const m = minutes % 60;
  // a time of day never goes past 24h, and its hour part is the clock hour
  const d = clockStyle ? 0 : Math.floor(totalHours / 24);
  const h = clockStyle ? totalHours : totalHours % 24;
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const fmt = new Intl.DurationFormat(lang, {
      style: format, // "long", "short", or "narrow"
      ...(clockStyle ? { hoursDisplay: "always" } : {}),
    });
    const duration = {};
    if (d > 0) {
      duration.days = d;
    }
    if (h > 0 || clockStyle || d > 0) {
      duration.hours = h;
    }
    if (m > 0 || (d === 0 && h === 0)) {
      duration.minutes = m;
    }
    return fmt.format(duration);
  }
  // format="compact": "1j12h", "1h30", "45min", "2h" — no minute symbol when hours are present
  const dSym = naviI18n("time.duration.day_symbol", undefined, { lang });
  const hSym = naviI18n("time.duration.hour_symbol", undefined, { lang });
  const mSym = naviI18n("time.duration.minute_symbol", undefined, { lang });
  const dStr = d > 0 ? `${formatCompactNumber(d, lang)}${dSym}` : "";
  const hStr =
    clockStyle && pad
      ? String(h).padStart(2, "0")
      : formatCompactNumber(h, lang);
  if (d === 0 && h === 0 && !clockStyle) {
    return `${m}${mSym}`;
  }
  if (m === 0) {
    if (clockStyle) {
      // "10h00" on a clock, "2h" for a real 2 hours duration — except at
      // precision "hour", where a clock drops the zero minute too ("10h"),
      // the way one says it out loud
      return precision === "minute" ? `${hStr}${hSym}00` : `${hStr}${hSym}`;
    }
    return h === 0 ? dStr : `${dStr}${hStr}${hSym}`;
  }
  return `${dStr}${hStr}${hSym}${String(m).padStart(2, "0")}`;
};

// "forceUnit": stay in the unit the value is expressed in, however big it gets
const formatSingleUnit = (value, unit, { lang, format }) => {
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    return new Intl.DurationFormat(lang, {
      style: format,
      // Intl drops a zero-valued unit, and "0 minute" is the whole point here
      [`${unit}sDisplay`]: "always",
    }).format({
      [`${unit}s`]: value,
    });
  }
  const symbol = naviI18n(`time.duration.${unit}_symbol`, undefined, { lang });
  return `${formatCompactNumber(value, lang)}${symbol}`;
};

/**
 * Formats a duration expressed in hours (possibly fractional) as a human-readable string.
 * Delegates to {@link formatMinuteDuration} after converting hours to minutes.
 *
 * @param {number} hours
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", forceUnit?: boolean }} [options]
 * @param {boolean} [options.forceUnit=false] - Keep the value in hours however
 *   big it gets ("36 heures" instead of "1 jour et 12 heures"). Ignored for a
 *   fractional value, which has no single-unit spelling.
 *
 * @example
 * formatHourDuration(1.5, { lang: "fr" })                       // "1 heure 30 minutes" (long, default)
 * formatHourDuration(1.5, { lang: "fr", format: "compact" })   // "1h30"
 * formatHourDuration(2, { lang: "en", format: "compact" })     // "2h"
 * formatHourDuration(36, { lang: "fr" })                        // "1 jour et 12 heures"
 * formatHourDuration(36, { lang: "fr", forceUnit: true })      // "36 heures"
 */
const formatHourDuration = (hours, options = {}) => {
  const { lang = getRuntimeLang(), format = "long", forceUnit } = options;
  if (hours === 0 || (forceUnit && Number.isInteger(hours))) {
    return formatSingleUnit(hours, "hour", { lang, format });
  }
  // a fractional value has no single-unit spelling, it needs its minutes
  const totalMinutes = Math.round(hours * 60);
  return formatMinuteDuration(totalMinutes, { ...options, forceUnit: false });
};

/**
 * Formats a duration expressed in seconds as a human-readable string.
 * "long", "short", "narrow" delegate to Intl.DurationFormat.
 * "compact" uses our own symbol-based notation.
 *
 * @param {number} seconds
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact", forceUnit?: boolean }} [options]
 * @param {boolean} [options.forceUnit=false] - Keep the value in seconds
 *   however big it gets ("90 000 secondes" instead of "1 jour et 1 heure").
 *
 * @example
 * formatSecondDuration(90, { lang: "fr" })                       // "1 minute 30 secondes" (long, default)
 * formatSecondDuration(90, { lang: "fr", format: "short" })     // "1 min. et 30 s." (Intl short)
 * formatSecondDuration(90, { lang: "fr", format: "narrow" })    // "1min 30s" (Intl narrow)
 * formatSecondDuration(90, { lang: "fr", format: "compact" })   // "1m30s" (custom)
 * formatSecondDuration(45, { lang: "en", format: "compact" })   // "45s"
 */
const formatSecondDuration = (
  seconds,
  { lang = getRuntimeLang(), format = "long", forceUnit = false } = {},
) => {
  if (seconds < 0) {
    // the d/h/m/s split below only holds for a positive value; formatting the
    // magnitude and putting the sign back is the only reading that works
    return `-${formatSecondDuration(-seconds, { lang, format, forceUnit })}`;
  }
  if (forceUnit || seconds === 0) {
    return formatSingleUnit(seconds, "second", { lang, format });
  }
  const totalHours = Math.floor(seconds / 3600);
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const fmt = new Intl.DurationFormat(lang, { style: format });
    const duration = {};
    if (d > 0) duration.days = d;
    if (h > 0) duration.hours = h;
    if (m > 0) duration.minutes = m;
    if (s > 0 || (d === 0 && h === 0 && m === 0)) duration.seconds = s;
    return fmt.format(duration);
  }
  // compact: "1d1h30m45s", "1h30m45s", "1m30s", "45s"
  const dSym = naviI18n("time.duration.day_symbol", undefined, { lang });
  const hSym = naviI18n("time.duration.hour_symbol", undefined, { lang });
  const mSym = naviI18n("time.duration.minute_symbol", undefined, { lang });
  const sSym = naviI18n("time.duration.second_symbol", undefined, { lang });
  const parts = [];
  // h/m/s are bounded by construction (never need grouping); d can be
  // arbitrarily large for a long duration.
  if (d > 0) parts.push(`${formatCompactNumber(d, lang)}${dSym}`);
  if (h > 0) parts.push(`${h}${hSym}`);
  if (m > 0) parts.push(`${m}${mSym}`);
  if (s > 0 || parts.length === 0) parts.push(`${s}${sSym}`);
  return parts.join("");
};

/**
 * Formats a duration object as a human-readable string.
 * Reads the parts directly — no conversion to seconds — so years/months/days
 * are preserved as-is and non-numeric mid-edit values (e.g. "2a") are rendered
 * with their unit symbol rather than being stringified.
 *
 * @param {string|number|{ years?: any, months?: any, weeks?: any, days?: any,
 *           hours?: any, minutes?: any, seconds?: any, milliseconds?: any }} duration -
 *   A string goes through {@link parseDuration} ("PT1H30M", "1h30"), a number
 *   is read as seconds. Each unit is written with the value it carries: 90
 *   minutes reads "90 minutes", never "1 heure 30" — the variants that
 *   promote a count into bigger units are {@link formatMinuteDuration},
 *   {@link formatHourDuration} and {@link formatSecondDuration}.
 * @param {{ lang?: string, format?: "long"|"short"|"narrow"|"compact" }} [options]
 *
 * @example
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr" })                       // "2 heures 15 minutes" (long, default)
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr", format: "short" })     // "2 h et 15 min" (Intl short)
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr", format: "narrow" })    // "2h 15min" (Intl narrow)
 * formatDuration({ hours: 2, minutes: 15 }, { lang: "fr", format: "compact" })   // "2h15" (custom, no minute symbol)
 * formatDuration({ minutes: 45 }, { lang: "fr", format: "compact" })             // "45min"
 * formatDuration({ hours: 0, minutes: 0 }, { lang: "fr" })                        // "0 minute"
 * formatDuration({ hours: "2a", minutes: "15" }, { lang: "fr", format: "compact" }) // "2ah15"
 */
const formatDuration = (
  duration,
  { lang = getRuntimeLang(), format = "long" } = {},
) => {
  if (typeof duration === "string") {
    duration = parseDuration(duration) ?? {};
  } else if (typeof duration === "number") {
    duration = { seconds: duration };
  }
  const has = (key) => duration[key] !== undefined && duration[key] !== null;

  // "long" and "narrow" delegate to Intl.DurationFormat when available and all values are numeric.
  //
  // "short" always uses our own compact symbols ("2h15", "45min") because:
  // 1. We omit the minute symbol when hours are also present ("2h15" not "2h 15 min"),
  //    which Intl.DurationFormat style:"narrow" does not do.
  // 2. Non-numeric mid-edit values (e.g. { hours: "2a" }) must render as-is with their
  //    unit symbol — Intl.DurationFormat only accepts integers.
  if (format !== "compact" && typeof Intl.DurationFormat !== "undefined") {
    const intlDuration = {};
    let allNumeric = true;
    let hasNegative = false;
    let hasPositive = false;
    for (const key of [
      "years",
      "months",
      "weeks",
      "days",
      "hours",
      "minutes",
      "seconds",
      "milliseconds",
    ]) {
      if (!has(key)) {
        continue;
      }
      const n = Number(duration[key]);
      if (!isFinite(n)) {
        allNumeric = false;
        break;
      }
      if (n < 0) {
        hasNegative = true;
      } else if (n > 0) {
        hasPositive = true;
      }
      intlDuration[key] = n;
    }
    // Temporal requires all components to share the same sign.
    // Mixed-sign values (e.g. { hours: -1, minutes: 15 }) throw a RangeError.
    if (
      allNumeric &&
      Object.keys(intlDuration).length > 0 &&
      !(hasNegative && hasPositive)
    ) {
      if (!hasNegative && !hasPositive) {
        return formatSingleUnit(0, smallestUnitOf(intlDuration), {
          lang,
          format,
        });
      }
      return new Intl.DurationFormat(lang, { style: format }).format(
        intlDuration,
      );
    }
    // Fall through to compact notation when values are non-numeric or mixed-sign
  }

  // A component explicitly present but numerically zero (e.g. the demo's own
  // { hours: 0, minutes: 5 }) conveys no information for a genuine duration
  // — same convention formatMinuteDuration/formatSecondDuration already
  // follow (checking h > 0/m > 0, not merely "was a value passed") — so
  // it's dropped here too, regardless of whether the caller included the
  // key at all. Non-numeric mid-edit values (e.g. "2a") still count as
  // present — Number("2a") is NaN, never === 0 — so those keep rendering
  // as-is with their own unit symbol. When every component is zero there is
  // nothing left to drop, so the zero itself is rendered — see below.
  const hasNonZero = (key) => has(key) && Number(duration[key]) !== 0;

  const sym = (key) =>
    naviI18n(`time.duration.${key}_symbol`, undefined, { lang });
  const parts = [];

  if (hasNonZero("years")) {
    parts.push(`${formatCompactNumber(duration.years, lang)}${sym("year")}`);
  }
  if (hasNonZero("months")) {
    parts.push(`${formatCompactNumber(duration.months, lang)}${sym("month")}`);
  }
  if (hasNonZero("weeks")) {
    parts.push(`${formatCompactNumber(duration.weeks, lang)}${sym("week")}`);
  }
  if (hasNonZero("days")) {
    parts.push(`${formatCompactNumber(duration.days, lang)}${sym("day")}`);
  }

  // Hours + minutes: when both present, pad minutes to 2 digits after the h
  // symbol — minutes stays a plain 2-digit pad (it's always 0-59 by
  // convention), only hours goes through grouping.
  const hSym = sym("hour");
  const mSym = sym("minute");
  if (hasNonZero("hours") && hasNonZero("minutes")) {
    parts.push(
      `${formatCompactNumber(duration.hours, lang)}${hSym}${String(duration.minutes).padStart(2, "0")}`,
    );
  } else if (hasNonZero("hours")) {
    parts.push(`${formatCompactNumber(duration.hours, lang)}${hSym}`);
  } else if (hasNonZero("minutes")) {
    parts.push(`${formatCompactNumber(duration.minutes, lang)}${mSym}`);
  }

  if (hasNonZero("seconds")) {
    parts.push(
      `${formatCompactNumber(duration.seconds, lang)}${sym("second")}`,
    );
  }
  if (hasNonZero("milliseconds")) {
    parts.push(
      `${formatCompactNumber(duration.milliseconds, lang)}${sym("millisecond")}`,
    );
  }
  if (parts.length > 0) {
    return parts.join("");
  }
  // everything was zero: say so in the smallest unit the caller mentioned,
  // rather than a bare "0" whose unit the reader has to guess
  const smallestUnit = smallestUnitOf(duration);
  return smallestUnit ? `0${sym(smallestUnit)}` : "0";
};

const UNIT_KEYS = [
  "years",
  "months",
  "weeks",
  "days",
  "hours",
  "minutes",
  "seconds",
  "milliseconds",
];
const smallestUnitOf = (duration) => {
  for (const key of [...UNIT_KEYS].reverse()) {
    if (duration[key] !== undefined && duration[key] !== null) {
      return key.slice(0, -1); // "seconds" -> "second"
    }
  }
  return null;
};

/**
 * Formats a date relative to now: "il y a 3 jours", "dans 2 heures", etc.
 */
const formatTimeAgo = (
  date,
  { lang = getRuntimeLang(), now = new Date(), bare, format = "long" } = {},
) => {
  const rtf = new Intl.RelativeTimeFormat(lang, {
    numeric: "auto",
    style: format,
  });
  const nowMs = now instanceof Date ? now.getTime() : now;
  const diff = date.getTime() - nowMs;
  const absDiff = Math.abs(diff);

  let value;
  let unit;
  if (absDiff < MINUTE) {
    value = Math.round(diff / 1000);
    unit = "second";
  } else if (absDiff < HOUR) {
    value = Math.round(diff / MINUTE);
    unit = "minute";
  } else if (absDiff < DAY) {
    value = Math.round(diff / HOUR);
    unit = "hour";
  } else if (absDiff < 7 * DAY) {
    value = Math.round(diff / DAY);
    unit = "day";
  } else if (absDiff < 30 * DAY) {
    value = Math.round(diff / (7 * DAY));
    unit = "week";
  } else if (absDiff < YEAR) {
    value = Math.round(diff / (30 * DAY));
    unit = "month";
  } else {
    value = Math.round(diff / YEAR);
    unit = "year";
  }

  if (!bare || value >= 0) {
    return rtf.format(value, unit);
  }
  // Drop the leading past-tense literal ("il y a ", "ago ") — keep only integer + unit.
  const parts = rtf.formatToParts(value, unit);
  const integerIndex = parts.findIndex((p) => p.type === "integer");
  return parts
    .slice(integerIndex)
    .map((p) => p.value)
    .join("")
    .trim();
};

/**
 * Formats a timed event with an optional duration window.
 *
 * States:
 * - Future  (now < start)              → "dans 1 heure 30", "demain à 15h", …
 * - Ongoing (start ≤ now < start+dur)  → "En cours"
 * - Past    (now ≥ start+dur)          → relative ("il y a 2 heures", …)
 *
 * @param {Date|number} start      Start of the event (Date or ms timestamp)
 * @param {number}      durationMs Duration in milliseconds (0 = instant event)
 * @param {{ lang?: string, now?: Date|number, bare?: boolean, format?: "long"|"short"|"narrow" }} options
 *
 * @example
 * // 90 min from now
 * formatTimeRelative(Date.now() + 90 * 60_000, 0, { lang: "fr" }) // "dans 1 heure 30"
 * // currently happening (30 min window)
 * formatTimeRelative(Date.now() - 5 * 60_000, 30 * 60_000, { lang: "fr" }) // "En cours"
 * // ended 2 hours ago
 * formatTimeRelative(Date.now() - 3 * 3_600_000, 3_600_000, { lang: "fr" }) // "il y a 2 heures"
 * // short format
 * formatTimeRelative(Date.now() - 3 * 3_600_000, 0, { lang: "fr", format: "short" }) // "il y a 3 h"
 */
const formatTimeRelative = (
  start,
  durationMs = 0,
  { lang = getRuntimeLang(), now = new Date(), bare, format = "long" } = {},
) => {
  const startMs = start instanceof Date ? start.getTime() : Number(start);
  const endMs = startMs + durationMs;
  const nowMs = now instanceof Date ? now.getTime() : Number(now);

  if (nowMs >= startMs && nowMs < endMs) {
    return getOngoingText(lang);
  }
  if (nowMs >= endMs) {
    const refDate = endMs > startMs ? new Date(endMs) : new Date(startMs);
    return formatTimeAgo(refDate, { lang, now, bare, format });
  }

  const diff = startMs - nowMs;
  return formatFuture(new Date(startMs), diff, { lang, now, format });
};

const formatFuture = (date, diff, { lang, now, format = "long" }) => {
  const rtf = new Intl.RelativeTimeFormat(lang, {
    numeric: "auto",
    style: format,
  });
  const nowDate = now instanceof Date ? now : new Date(now);

  // < 1 min
  if (diff < MINUTE) {
    return getLessThanMinuteText(lang);
  }

  // < 1 hour → "dans X minutes"
  if (diff < HOUR) {
    return rtf.format(Math.ceil(diff / MINUTE), "minute");
  }

  // 1h to 2h → "dans 1 heure 30"
  if (diff < 2 * HOUR) {
    const hours = Math.floor(diff / HOUR);
    const minutes = Math.round((diff % HOUR) / MINUTE);
    if (minutes === 0) {
      return rtf.format(hours, "hour");
    }
    const duration = formatMinuteDuration(hours * 60 + minutes, {
      lang,
      format,
    });
    const template = naviI18n("time.in_duration", undefined, { lang });
    if (template !== "time.in_duration") {
      return template.replace("[duration]", duration);
    }
    return `in ${duration}`;
  }

  // < 6h → "dans X heures" (precise enough, skip tomorrow label)
  if (diff < 6 * HOUR) {
    return rtf.format(Math.round(diff / HOUR), "hour");
  }

  // Tomorrow (calendar day) and within ~30h → "demain à 15h"
  const tomorrowDate = new Date(nowDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (diff < 30 * HOUR && toLocalDayKey(date) === toLocalDayKey(tomorrowDate)) {
    return formatTomorrowAt(date, lang);
  }

  // < 24h → "dans X heures"
  if (diff < DAY) {
    return rtf.format(Math.round(diff / HOUR), "hour");
  }

  // < 7 days → "dans X jours"
  if (diff < 7 * DAY) {
    return rtf.format(Math.round(diff / DAY), "day");
  }

  // < 30 days → "dans X semaines"
  if (diff < 30 * DAY) {
    return rtf.format(Math.round(diff / (7 * DAY)), "week");
  }

  // months (Intl handles "le mois prochain" when value = 1)
  if (diff < YEAR) {
    return rtf.format(Math.round(diff / (30 * DAY)), "month");
  }

  return rtf.format(Math.round(diff / YEAR), "year");
};

const formatTomorrowAt = (date, lang) => {
  const dayLabel = new Intl.RelativeTimeFormat(lang, {
    numeric: "auto",
  }).format(1, "day");
  const hasMinutes = date.getMinutes() !== 0;
  const timeLabel = new Intl.DateTimeFormat(lang, {
    hour: "numeric",
    ...(hasMinutes ? { minute: "2-digit" } : {}),
  }).format(date);
  const atTemplate = naviI18n("time.tomorrow_at", undefined, {
    lang,
  });
  // atTemplate is e.g. "[day] à [time]" — replace placeholders
  if (atTemplate !== "time.tomorrow_at") {
    return atTemplate.replace("[day]", dayLabel).replace("[time]", timeLabel);
  }
  // fallback: concatenate with a space
  return `${dayLabel} ${timeLabel}`;
};

const getLessThanMinuteText = (lang) => {
  return naviI18n("time.less_than_minute", undefined, { lang });
};

const getOngoingText = (lang) => {
  return naviI18n("time.ongoing", undefined, { lang });
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

// Compares calendar days in local time (ignores the clock time)
const toLocalDayKey = (date) => {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/**
 * Coerces what `<Time>` accepts as a value — a Date, a ms timestamp, a
 * parseable string — into a Date, or null when it cannot. `parseString`
 * lets a caller claim the string forms it recognizes ("HH:MM" for a
 * time-of-day, "YYYY-MM" for a month…) before the generic ones apply.
 */
const toDate = (value, parseString) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    if (parseString) {
      return parseString(value);
    }
    // "YYYY-MM-DD" — use local midnight to avoid UTC shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(`${value}T00:00:00`);
      return isNaN(d.getTime()) ? null : d;
    }
    // ISO / other parseable strings
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const toTimeOfDay = (value) => {
  return toDate(value, (string) => {
    if (/^\d{2}:\d{2}(?::\d{2})?$/.test(string)) {
      const d = new Date(`1970-01-01T${string}`);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  });
};

export { formatDatePlaceholder, formatDatetime, formatDatetimePlaceholder, formatDay, formatDayRelative, formatDuration, formatHourDuration, formatMinuteDuration, formatMonth, formatMonthPlaceholder, formatSecondDuration, formatTime, formatTimeOfDay, formatTimeRange, formatTimeRelative, formatWeekPlaceholder, getRelativeDay, resolveTimeRangePrecision, toDate, toTimeOfDay };
//# sourceMappingURL=jsenv_navi_format_time.js.map
