import { createI18n } from "./i18n.js";

/**
 * The shared i18n instance for all @jsenv/navi components.
 *
 * Use `naviI18n.add(key, { lang: "translation" })` to register or override
 * any text used by navi components. The active language is read from
 * `langSignal` (the browser's current `navigator.language`).
 *
 * Built-in keys (can be overridden):
 *   - `"time.less_than_minute"` — e.g. "in less than a minute"
 *   - `"time.ongoing"`          — e.g. "Ongoing"
 *   - `"time.tomorrow_at"`      — e.g. "[day] at [time]" ([day] and [time] are placeholders)
 *
 * @example
 * import { naviI18n } from "@jsenv/navi";
 *
 * // Register unit translations for Quantity:
 * naviI18n.add("minute",         { en: "minute",  fr: "minute"  });
 * naviI18n.add("minute__plural", { en: "minutes", fr: "minutes" });
 *
 * // Register multiple keys at once:
 * naviI18n.addAll({
 *   minute:           { en: "minute",  fr: "minute"  },
 *   minute__plural:   { en: "minutes", fr: "minutes" },
 * });
 *
 * // Override a built-in text:
 * naviI18n.add("time.ongoing", { fr: "En cours…" });
 *
 * // Load a full language pack at once:
 * naviI18n.addLangKeys("fr", { minute: "minute", "minute__plural": "minutes" });
 */
export const naviI18n = createI18n();

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
});

// Field name substitutions used in constraint messages
naviI18n.addAll({
  "constraint.field.password": {
    fr: "Ce mot de passe",
    en: "This password",
  },
  "constraint.field.email": {
    fr: "Cette adresse e-mail",
    en: "This email address",
  },
  "constraint.field.checkbox": {
    fr: "Cette case",
    en: "This checkbox",
  },
  "constraint.field.radio": {
    fr: "Cette option",
    en: "This option",
  },
  "constraint.field.default": {
    fr: "Ce champ",
    en: "This field",
  },
});

// Constraint validation messages — override any key to customize error messages
naviI18n.addAll({
  "constraint.available": {
    fr: '"[value]" est utilisé. Veuillez entrer une autre valeur.',
    en: '"[value]" is already taken. Please enter a different value.',
  },
  "picker.required.day": {
    fr: "Veuillez sélectionner un jour.",
    en: "Please select a day.",
  },
  "picker.required.month": {
    fr: "Veuillez sélectionner un mois.",
    en: "Please select a month.",
  },
  "picker.required.week": {
    fr: "Veuillez sélectionner une semaine.",
    en: "Please select a week.",
  },
  "picker.required.time": {
    fr: "Veuillez sélectionner une heure.",
    en: "Please select a time.",
  },
  "picker.required.datetime": {
    fr: "Veuillez sélectionner une date et une heure.",
    en: "Please select a date and time.",
  },
  "picker.required.color": {
    fr: "Veuillez sélectionner une couleur.",
    en: "Please select a color.",
  },
  "picker.hour.no_slots": {
    fr: "Aucune heure disponible.",
    en: "No available time slots.",
  },
  "picker.hour.readonly_slot": {
    fr: "Cet horaire n'est pas disponible.",
    en: "This time slot is not available.",
  },
  "list_item.required": {
    fr: "Veuillez sélectionner une option.",
    en: "Please select an option.",
  },
  "list_item.readonly": {
    fr: "Cette option n'est pas disponible.",
    en: "This option is not available.",
  },
  "constraint.disabled": {
    fr: "[field] est désactivé.",
    en: "[field] is disabled.",
  },
  "constraint.required.checkbox": {
    fr: "Veuillez cocher cette case.",
    en: "Please check this box.",
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
  "constraint.required.select": {
    fr: "Veuillez sélectionner une option.",
    en: "Please select an option.",
  },
  "constraint.required.default": {
    fr: "Veuillez remplir ce champ.",
    en: "Please fill in this field.",
  },
  "constraint.pattern": {
    fr: "[field] ne correspond pas au format requis.",
    en: "[field] does not match the required format.",
  },
  "constraint.type.email.at": {
    fr: 'Veuillez inclure "@" dans l\'adresse e-mail. Il manque un symbole "@" dans [value].',
    en: 'Please include "@" in the email address. "@" is missing in [value].',
  },
  "constraint.type.email.invalid": {
    fr: "Veuillez saisir une adresse e-mail valide.",
    en: "Please enter a valid email address.",
  },
  "constraint.min_length.singular": {
    fr: "[field] doit contenir au moins [min] caractère (il contient actuellement un seul caractère).",
    en: "[field] must contain at least [min] character (it currently contains only one character).",
  },
  "constraint.min_length.plural": {
    fr: "[field] doit contenir au moins [min] caractères (il contient actuellement [count] caractères).",
    en: "[field] must contain at least [min] characters (it currently contains [count] characters).",
  },
  "constraint.max_length": {
    fr: "[field] doit contenir au maximum [max] caractères (il contient actuellement [count] caractères).",
    en: "[field] must contain at most [max] characters (it currently contains [count] characters).",
  },
  "constraint.type.number": {
    fr: "[field] doit être un nombre.",
    en: "[field] must be a number.",
  },
  "constraint.min.number": {
    fr: "[field] doit être supérieur ou égal à <strong>[min]</strong>.",
    en: "[field] must be greater than or equal to <strong>[min]</strong>.",
  },
  "constraint.min.time": {
    fr: "[field] doit être <strong>[min]</strong> ou plus.",
    en: "[field] must be <strong>[min]</strong> or later.",
  },
  "constraint.min.date.today": {
    fr: "La date doit être aujourd'hui ou dans le futur.",
    en: "The date must be today or in the future.",
  },
  "constraint.min.date": {
    fr: "La date doit être à partir du <strong>[min]</strong>.",
    en: "The date must be on or after <strong>[min]</strong>.",
  },
  "constraint.max.date.today": {
    fr: "La date doit être aujourd'hui ou dans le passé.",
    en: "The date must be today or in the past.",
  },
  "constraint.max.date": {
    fr: "La date doit être au plus tard le <strong>[max]</strong>.",
    en: "The date must be on or before <strong>[max]</strong>.",
  },
  "constraint.max.number": {
    fr: "[field] doit être <strong>[max]</strong> ou moins.",
    en: "[field] must be <strong>[max]</strong> or less.",
  },
  "constraint.max.time": {
    fr: "[field] doit être <strong>[max]</strong> ou moins.",
    en: "[field] must be <strong>[max]</strong> or less.",
  },
  "constraint.single_space.start": {
    fr: "[field] ne doit pas commencer par un espace.",
    en: "[field] must not start with a space.",
  },
  "constraint.single_space.end": {
    fr: "[field] ne doit pas finir par un espace.",
    en: "[field] must not end with a space.",
  },
  "constraint.single_space.consecutive": {
    fr: "[field] ne doit pas contenir plusieurs espaces consécutifs.",
    en: "[field] must not contain consecutive spaces.",
  },
  "constraint.min_lower_letter.singular": {
    fr: "[field] doit contenir au moins une lettre minuscule.",
    en: "[field] must contain at least one lowercase letter.",
  },
  "constraint.min_lower_letter.plural": {
    fr: "[field] contenir au moins [min] lettres minuscules.",
    en: "[field] must contain at least [min] lowercase letters.",
  },
  "constraint.min_upper_letter.singular": {
    fr: "[field] doit contenir au moins une lettre majuscule.",
    en: "[field] must contain at least one uppercase letter.",
  },
  "constraint.min_upper_letter.plural": {
    fr: "[field] contenir au moins [min] lettres majuscules.",
    en: "[field] must contain at least [min] uppercase letters.",
  },
  "constraint.min_digit.singular": {
    fr: "[field] doit contenir au moins un chiffre.",
    en: "[field] must contain at least one digit.",
  },
  "constraint.min_digit.plural": {
    fr: "[field] doit contenir au moins [min] chiffres.",
    en: "[field] must contain at least [min] digits.",
  },
  "constraint.min_special_char.singular": {
    fr: "[field] doit contenir au moins un caractère spécial. ([charset])",
    en: "[field] must contain at least one special character. ([charset])",
  },
  "constraint.min_special_char.plural": {
    fr: "[field] doit contenir au moins [min] caractères spéciaux. ([charset])",
    en: "[field] must contain at least [min] special characters. ([charset])",
  },
});
