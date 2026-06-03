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

// Constraint validation messages — override any key to customize error messages
naviI18n.addAll({
  "constraint.available": {
    fr: '"[value]" est utilisé. Veuillez entrer une autre valeur.',
    en: '"[value]" is already taken. Please enter a different value.',
  },
  "constraint.required.date": {
    fr: "Veuillez sélectionner un jour.",
    en: "Please select a day.",
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
  "constraint.disabled.password": {
    fr: "Ce mot de passe est désactivé.",
    en: "This password is disabled.",
  },
  "constraint.disabled.email": {
    fr: "Cette adresse e-mail est désactivée.",
    en: "This email address is disabled.",
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
  "constraint.readonly.busy": {
    fr: "Cet élément est occupé.",
    en: "This element is busy.",
  },
  "constraint.readonly.button": {
    fr: "Cette action n'est pas disponible pour l'instant.",
    en: "This action is not available right now.",
  },
  "constraint.readonly.button_busy": {
    fr: "Cette action est en cours...",
    en: "This action is in progress...",
  },
  "constraint.readonly.option": {
    fr: "Cette option n'est pas disponible.",
    en: "This option is not available.",
  },
  "constraint.readonly.default": {
    fr: "Cet élément est en lecture seule et ne peut pas être modifié.",
    en: "This element is read-only and cannot be modified.",
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
  "constraint.type.number.default": {
    fr: "Ce champ doit être un nombre.",
    en: "This field must be a number.",
  },
  "constraint.min.number.default": {
    fr: "Ce champ doit être supérieur ou égal à <strong>[min]</strong>.",
    en: "This field must be greater than or equal to <strong>[min]</strong>.",
  },
  "constraint.min.time.default": {
    fr: "Ce champ doit être <strong>[min]</strong> ou plus.",
    en: "This field must be <strong>[min]</strong> or later.",
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
    fr: "Ce champ doit être <strong>[max]</strong> ou moins.",
    en: "This field must be <strong>[max]</strong> or less.",
  },
  "constraint.max.time.default": {
    fr: "Ce champ doit être <strong>[max]</strong> ou moins.",
    en: "This field must be <strong>[max]</strong> or less.",
  },
  "constraint.single_space.start.default": {
    fr: "Ce champ ne doit pas commencer par un espace.",
    en: "This field must not start with a space.",
  },
  "constraint.single_space.end.default": {
    fr: "Ce champ ne doit pas finir par un espace.",
    en: "This field must not end with a space.",
  },
  "constraint.single_space.consecutive.default": {
    fr: "Ce champ ne doit pas contenir plusieurs espaces consécutifs.",
    en: "This field must not contain consecutive spaces.",
  },
  "constraint.min_lower_letter.singular.password": {
    fr: "Ce mot de passe doit contenir au moins une lettre minuscule.",
    en: "This password must contain at least one lowercase letter.",
  },
  "constraint.min_lower_letter.singular.default": {
    fr: "Ce champ doit contenir au moins une lettre minuscule.",
    en: "This field must contain at least one lowercase letter.",
  },
  "constraint.min_lower_letter.plural.password": {
    fr: "Ce mot de passe doit contenir au moins [min] lettres minuscules.",
    en: "This password must contain at least [min] lowercase letters.",
  },
  "constraint.min_lower_letter.plural.default": {
    fr: "Ce champ doit contenir au moins [min] lettres minuscules.",
    en: "This field must contain at least [min] lowercase letters.",
  },
  "constraint.min_upper_letter.singular.password": {
    fr: "Ce mot de passe doit contenir au moins une lettre majuscule.",
    en: "This password must contain at least one uppercase letter.",
  },
  "constraint.min_upper_letter.singular.default": {
    fr: "Ce champ doit contenir au moins une lettre majuscule.",
    en: "This field must contain at least one uppercase letter.",
  },
  "constraint.min_upper_letter.plural.password": {
    fr: "Ce mot de passe doit contenir au moins [min] lettres majuscules.",
    en: "This password must contain at least [min] uppercase letters.",
  },
  "constraint.min_upper_letter.plural.default": {
    fr: "Ce champ doit contenir au moins [min] lettres majuscules.",
    en: "This field must contain at least [min] uppercase letters.",
  },
  "constraint.min_digit.singular.password": {
    fr: "Ce mot de passe doit contenir au moins un chiffre.",
    en: "This password must contain at least one digit.",
  },
  "constraint.min_digit.singular.default": {
    fr: "Ce champ doit contenir au moins un chiffre.",
    en: "This field must contain at least one digit.",
  },
  "constraint.min_digit.plural.password": {
    fr: "Ce mot de passe doit contenir au moins [min] chiffres.",
    en: "This password must contain at least [min] digits.",
  },
  "constraint.min_digit.plural.default": {
    fr: "Ce champ doit contenir au moins [min] chiffres.",
    en: "This field must contain at least [min] digits.",
  },
  "constraint.min_special_char.singular.password": {
    fr: "Ce mot de passe doit contenir au moins un caractère spécial. ([charset])",
    en: "This password must contain at least one special character. ([charset])",
  },
  "constraint.min_special_char.singular.default": {
    fr: "Ce champ doit contenir au moins un caractère spécial. ([charset])",
    en: "This field must contain at least one special character. ([charset])",
  },
  "constraint.min_special_char.plural.password": {
    fr: "Ce mot de passe doit contenir au moins [min] caractères spéciaux. ([charset])",
    en: "This password must contain at least [min] special characters. ([charset])",
  },
  "constraint.min_special_char.plural.default": {
    fr: "Ce champ doit contenir au moins [min] caractères spéciaux. ([charset])",
    en: "This field must contain at least [min] special characters. ([charset])",
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
