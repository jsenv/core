import { humanizeI18n } from "@jsenv/humanize";

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
 * It is `humanizeI18n` itself, the registry @jsenv/humanize keeps for the
 * built-in texts of jsenv libraries: navi registers its keys in it, the
 * formatters (`formatDay`, `formatDuration`…) read their own `time.*` words
 * from it, and an app overriding any of them has a single handle for both.
 *
 * The active language is read from `languagesSignal` (see lang_signal.js —
 * combines the browser's own `navigator.languages`, an optional
 * `setPreferredLanguage()` user override, and an optional
 * `setSupportedLanguages()` app-wide allow-list), live on every lookup.
 *
 * Built-in key namespaces, all overridable — the registrations below are the
 * exhaustive list, read them to find the exact key to override:
 *   - `"button.*"`     — Clear, Reset, Send, Open, Close, Cancel, Confirm…
 *   - `"time.*"`       — what a clock writes between hours and minutes, and how the two ends of a span are named; the wording the formatters use is registered by @jsenv/humanize
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
export const naviI18n = humanizeI18n;

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
