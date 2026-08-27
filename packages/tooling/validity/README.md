# @jsenv/validity [![npm package](https://img.shields.io/npm/v/@jsenv/validity.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/validity)

Answer « is this value acceptable » — the same answer on the front and on the
back.

A rule config goes in, a validity object comes out. The field asks it while
someone types, the server asks it again when the value arrives, and both get the
same refusal for the same reason, in the same words.

```console
npm install @jsenv/validity
```

```js
import { createValidity } from "@jsenv/validity";

const [validity, applyOn] = createValidity({
  type: "string",
  maxLength: 500,
  charClass: "[^\u0000-\u001f\u007f]", // no control characters
  displayable: true,
  singleSpace: true,
});

applyOn("  hello");
validity.valid; // false
validity.singleSpace; // "must not start with a space"
validity.representations.valid.value; // "hello"
```

## Why it exists

Because a validation rule written twice drifts.

An app that checks « no more than 5 marks stacked on one character » in its
field and again on its server ends up with two rules that agree today and
disagree in three months. And the direction the drift takes decides how bad it
is: when the server is the stricter of the two, a value the field accepted comes
back as an error after the fact, on a screen that had already said yes.

So the rule lives in one place — here — and both sides run that one. What stays
on the front is what only a browser can do: refuse a keystroke before the value
exists, place a callout next to the field, read a `<datalist>`. « Is this string
acceptable » is not one of those.

## `createValidity(ruleConfig)`

Returns `[validity, applyOn]`.

`applyOn(value)` checks a value and writes the result into `validity`:

- `validity.valid` — whether every rule passed;
- `validity[ruleName]` — the sentence for that rule's refusal, `undefined` when
  it passed;
- `validity.representations.valid` — `{ type, value }`, the closest acceptable
  value when a rule knows how to suggest one (`null` when none does).

The full parameter list is on `createValidity`'s JSDoc — read it there rather
than here, it cannot drift from the code.

### Rules

| rule                      | what it refuses                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `type`                    | anything that is not a `number`, `date`, `duration`, `email`, `color`… (see `src/types.js`) |
| `min` / `max` / `step`    | a number, date or time outside the range, or off the step                                   |
| `oneOf`                   | a value not in the list                                                                     |
| `minLength` / `maxLength` | a string too short or too long                                                              |
| `charClass`               | a character the value may not hold                                                          |
| `displayable`             | what the layout cannot draw                                                                 |
| `singleSpace`             | a leading or trailing space, two in a row                                                   |
| `noEmoji`                 | an emoji, where a name, an identifier or a title does not want one                          |
| `maxLineBreaks`           | a value taller than it may be                                                               |

Three of them deserve more than a line.

**`charClass`** is a regex character class _body_, brackets included and nothing
else: `"[a-z0-9-]"`, `"[^\p{Cc}]"`. Written that way, the same string tests a
whole value here and a single keystroke in a field. `CHAR_CLASS_PRESETS` names
the usual ones — `tel`, `email`, `postal`, `iban`, `slug`, `hex`, `numeric`,
`noEmoji`… —
and a preset name is accepted wherever a class is. Compilation always uses the
`u` flag, so `\p{…}` works and a range covers whole code points rather than the
two halves an emoji is made of.

**`displayable`** covers what no character class can express: values whose every
character is legitimate alone and which, taken together, break a row, a card or
a list.

- marks stacked on one base character (« zalgo »): a diacritic is normal — a
  decomposed Vietnamese letter carries two, a vocalized Hebrew one three — what
  is not normal is the count. Thirty of them draw over the row above.
  `maxStackedMarks` raises the default of 5 for a language that needs more;
- a value that is not empty and yet shows nothing: only spaces, only marks, only
  format characters. An empty-looking line in a list reads as a bug;
- blank lines in series: forty newlines make a card as tall as the screen;
- a zero-width joiner that joins nothing. U+200D and U+200C are invisible and
  legitimate — the first assembles composed emoji, the second separates two
  letters in Persian — so they are refused only where they cannot be doing that
  job: at either end of the value, or against a space.

**`noEmoji`** is deliberately not part of `displayable`: a row survives an
emoji, so whether one belongs in a value is the app's call, not the layout's.
An emoji here is a character _presented_ as one — default emoji presentation, a
regional indicator (the halves of a flag), or any character carrying U+FE0F, the
selector that asks for emoji presentation. So `©` and `↔` stay text and only
`©️` and `↔️` are refused, which is what someone typing © in a name means. To
refuse the keystroke rather than the value, the same knowledge is the `noEmoji`
character class preset.

`maxLineBreaks` counts breaks rather than lines on purpose: how many lines a
value renders as depends on wrapping, which is the layout's answer, not the
value's.

## Messages are keys, not sentences

A rule never returns a finished sentence. It returns a key and its parameters:

```js
{ key: "max_length.default", params: { max: 500, count: 812 } }
```

`createValidity` turns that into a string through `formatMessage`, which
defaults to the English templates in `src/message.js`. Pass your own and the
same refusal is said in your app's language, by your server and by your field:

```js
const [validity, applyOn] = createValidity({
  type: "string",
  maxLength: 500,
  formatMessage: (key, params) => appI18n(`validity.${key}`, params),
});
```

Placeholders are written `[name]` — the delimiter `@jsenv/navi`'s i18n uses too,
so a template travels from one registry to the other untouched.

## Rules of your own

A business rule has no reason to live in a library. Pass it in `rules`:

```js
export const MAX_WORDS_RULE = {
  name: "maxWords",
  applyOn: (maxWords, value) => {
    if (maxWords === undefined || typeof value !== "string") {
      return null;
    }
    const count = value.trim().split(/\s+/).length;
    if (count <= maxWords) {
      return null;
    }
    return { key: "max_words", params: { max: maxWords, count } };
  },
};

const [validity, applyOn] = createValidity({
  type: "string",
  rules: [MAX_WORDS_RULE],
  maxWords: 40,
});

applyOn(longText);
validity.maxWords; // the refusal, under the rule's own name
```

- `name` is both the config property that parameterizes the rule and the key its
  refusal lands on;
- `applyOn(ruleValue, value, ruleConfig)` returns `null` when the value passes.
  `ruleValue` is `ruleConfig[name]` — a rule that must stay optional returns
  `null` when it is `undefined`;
- the refusal is `{ key, params }`, or a finished sentence when there is nothing
  to translate, or `{ key, params, autoFix }` when the rule knows a value that
  would pass.

## Front and back, sharing what is worth sharing

An app puts its rules in a package both sides read — and then decides, rule by
rule, who runs it. All three answers are legitimate:

- **both sides** — the rule goes in `rules`, and `@jsenv/navi` wears it as a
  constraint: `constraintFromValidityRule(MAX_WORDS_RULE, { maxWords: 40 })`.
  One rule, two callers, no drift;
- **the server alone** — a rule that needs the database, another user's data, or
  a secret. It stays in `rules` and the front never sees it; the refusal arrives
  with the response like any other;
- **the browser alone** — a rule about the gesture rather than about the value:
  what a keystroke may insert, what a callout says while typing. It is a navi
  constraint and nothing else — the server has no opinion on a keystroke.

The line to hold: the front may be laxer than the back, never stricter. A value
the field accepted and the server refuses is a promise broken after the fact.

## Also exported

- duration helpers — `parseDuration`, `durationToSeconds`,
  `durationToISOString`, `compareTwoDurations`… — ISO 8601 durations and the
  human-friendly strings (`"1h30min"`) that normalise into them;
- `CHAR_CLASS_PRESETS`, `resolveCharClass`, `compileCharClass`,
  `compileCharClassAnchored`, `getCharClassMessageKey` — the character classes,
  usable without `createValidity` (a field guarding a keystroke uses these);
- the rules themselves — `DISPLAYABLE_RULE`, `SINGLE_SPACE_RULE`,
  `MAX_LENGTH_RULE`, `MAX_LINE_BREAKS_RULE`, `MIN_LENGTH_RULE`,
  `CHAR_CLASS_RULE` — for a caller that wants one answer without building a
  whole validity object;
- `MESSAGE_TEMPLATES`, `formatMessageInEnglish` — the default sentences.
