/**
 * A rule names its refusal with a key and its parameters, never with a
 * finished sentence: the same refusal is shown by a field in the browser and
 * returned by a server, and both have to say it in the language of the person
 * reading. `createValidity({ formatMessage })` is where a caller plugs its own
 * translations in; the English templates below are what it falls back to.
 *
 * Placeholders are written `[name]` — the same delimiter @jsenv/navi's i18n
 * uses, so a template can travel from one registry to the other untouched.
 */

export const MESSAGE_TEMPLATES = {
  "type.mismatch": "must be a [type], got [actualType]",
  "type.string": "must be a string",
  "type.number": "must be a number",
  "type.number.finite": "must be finite",
  "type.integer": "must be an integer",
  "type.array": "must be an array, got [actualType]",
  "type.object": "must be an object, got [actualType]",
  "type.object.array": "must be an object, got array",
  "type.date.string": "must be a string in YYYY-MM-DD format",
  "type.date.format": "must be in YYYY-MM-DD format",
  "type.date.invalid": "must be a valid date",
  "type.datetime.string": "must be an ISO 8601 string",
  "type.datetime.invalid": "must be a valid datetime",
  "type.datetime_local.string": "must be a string in YYYY-MM-DDTHH:MM format",
  "type.datetime_local.format": "must be in YYYY-MM-DDTHH:MM format",
  "type.duration.invalid": `must be a valid duration string (e.g. "PT2H15M")`,
  "type.week.string": "must be a string in YYYY-Www format",
  "type.week.format": `must be in YYYY-Www format (e.g. "2024-W03")`,
  "type.month.string": "must be a string in YYYY-MM format or a timestamp",
  "type.month.format": "must be in YYYY-MM format",
  "type.month.range": "must be a valid month (01–12)",
  "type.year": "must be an integer year",
  "type.percentage": "must be a number between 0 and 100",
  "type.percentage.range": "must be between 0 and 100",
  "type.time.format": "must be in HH:MM or HH:MM:SS format",
  "type.email": "must be a valid email address",
  "type.url": "must be a valid URL",
  "type.color": "must be a valid color (hex, rgb, rgba, or named color)",

  "min.default": "must be >= [min]",
  "min.positive": "must be positive",
  "min.temporal": "must be on or after [min]",
  "max.default": "must be <= [max]",
  "max.negative": "must be negative",
  "max.temporal": "must be on or before [max]",

  "step.integer": "must be an integer",
  "step.multiple": "must be a multiple of [step]",
  "step.precision": "must have at most [decimals] decimal places",
  "step.multiple_and_precision":
    "must be a multiple of [step] with at most [decimals] decimal places",
  "step.time":
    "must be a multiple of [step]s from [min] (e.g. [before] or [after])",

  "one_of.default": "must be one of: [values]",

  "min_length.default": "must be at least [min] characters",
  "max_length.default": "must be at most [max] characters",
  "char_class.default": "must only contain allowed characters",
  "char_class.numeric": "must only contain digits",
  "char_class.alpha": "must only contain letters",
  "char_class.alphanumeric": "must only contain letters and digits",
  "char_class.uppercase": "must only contain uppercase letters",
  "char_class.hex": "must only contain hexadecimal digits (0-9, A-F)",
  "char_class.slug": "must only contain lowercase letters, digits and hyphens",
  "char_class.no_emoji": "must not contain emoji",
  "no_emoji.default": "must not contain emoji",
  "displayable.stacked_marks.singular":
    'must not contain a character stacking more than [max] marks: "[sample]"',
  "displayable.stacked_marks.plural":
    'must not contain [count] characters stacking more than [max] marks (such as "[sample]")',
  "displayable.invisible": "must contain at least one visible character",
  "displayable.blank_lines": "must not contain consecutive blank lines",
  "displayable.dangling_joiner":
    "must not contain a zero-width joiner that joins nothing",
  "single_space.start": "must not start with a space",
  "single_space.end": "must not end with a space",
  "single_space.consecutive": "must not contain consecutive spaces",
  "max_line_breaks.default": "must not contain more than [max] line breaks",
};

/**
 * A rule's refusal, before anyone turns it into a sentence. `params` is always
 * an object, so a `formatMessage` may read it without checking.
 */
export const message = (key, params = {}) => ({ key, params });

const PLACEHOLDER_REGEX = /\[([^\]]+)\]/g;

export const formatMessageInEnglish = (key, params) => {
  const template = MESSAGE_TEMPLATES[key];
  if (template === undefined) {
    return key;
  }
  return template.replace(PLACEHOLDER_REGEX, (placeholder, name) => {
    if (Object.hasOwn(params, name)) {
      return String(params[name]);
    }
    return placeholder;
  });
};
