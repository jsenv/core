# Field validation

What a control refuses, who decides it, and what is left for a server to say.

## The split

A control refuses a value for two very different kinds of reason, and keeping
them apart is the whole subject.

**What only a browser can answer.** A keystroke blocked before the value exists,
a callout placed next to the field, `required` on a radio group, `data-one-of`
reading an option list out of the document, the moment a message appears
(typing? blur? submit?).
This is navi's, and it stays navi's.

**« Is this value acceptable ».** A length, a set of allowed characters, a
value that renders nothing, a business rule. This is not a DOM question — a
server asks the same one about the same value — so it lives in
[@jsenv/validity](../../../tooling/validity/README.md) and navi consumes it.

The consequence that matters when writing an app: **do not write a constraint
for something a rule already answers**. If the sentence you are about to write
in a `check()` would make sense in a server's response, the knowledge belongs in
a validity rule, and the constraint is only its browser-side caller.

## Constraints

A constraint is `{ name, check(field) }`. `check` returns `null` when the value
passes, or the message to show — a string, or `{ message, target }` when the
callout belongs on another element than the control itself.

Navi's own constraints are switched on by an attribute on the control —
standard when the platform has one, `data-*` when it does not.

**They are written as props, in camelCase.** A constraint declares the attribute
it reads (`data-no-emoji`) and a control accepts the prop that stands for it
(`noEmoji`), putting it on the control host under the attribute name — the same
conversion `element.dataset` does. So `singleSpace` is what you write and
`data-single-space` is what ends up in the DOM (and in the devtools, and in a
test selector). The attribute form is accepted too, for a control written in
plain HTML.

| prop                            | attribute                                   | refuses                                                                         |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `required`, `pattern`           | same                                        | what the platform's attributes mean                                             |
| `minLength`, `maxLength`        | same                                        | a string too short or too long                                                  |
| `min`, `max`, `step`            | same                                        | a number, date, time or duration out of range                                   |
| `singleSpace`                   | `data-single-space`                         | a leading or trailing space, two in a row                                       |
| `displayable`                   | `data-displayable`                          | zalgo, a value showing nothing, blank lines in series, a joiner joining nothing |
| `maxStackedMarks`               | `data-max-stacked-marks`                    | (parameter of `displayable`)                                                    |
| `noEmoji`                       | `data-no-emoji`                             | an emoji, where a name, an identifier or a title does not want one              |
| `maxLineBreaks`                 | `data-max-line-breaks`                      | a value holding more line breaks than that                                      |
| `oneOf`                         | `data-one-of`                               | a value outside the option list its CSS selector points at                      |
| `sameAs`                        | `data-same-as`                              | a value differing from the field it names                                       |
| `minDigit`, `minUpperLetter`, … | `data-min-digit`, …                         | a password missing a kind of character                                          |
| `timeAfter`, `timeMinDuration`  | `data-time-after`, `data-time-min-duration` | a time span that ends before it starts, or is too short                         |

```jsx
<Input required singleSpace noEmoji maxLength={80} />
<Textarea displayable singleSpace maxLineBreaks={4} />
```

A boolean switch (`displayable`, `singleSpace`, `noEmoji`) passed as `false` is
off, so `noEmoji={settings.strictNames}` says what it looks like it says. The
others carry a value — a count, a selector — and are off by being absent.

Each constraint has a `<name>Message` prop (and a `data-<name>-message`
attribute) to replace its sentence for one field. To change it everywhere,
override the i18n key instead — see below.

Two props sit beside them and belong to the browser alone, because they act
before there is a value to validate: `charGuard` blocks a keystroke that is not
in its character class, `maxLengthGuard` blocks the one that would overflow (and
truncates a paste). Both show what they refused in a callout rather than
silently swallowing it.

`charGuard` takes a character class or one of validity's preset names, so a
field can refuse the keystroke with the same knowledge the value is checked
against: `charGuard="tel"`, `charGuard="slug"`, `charGuard="noEmoji"`. Refusing
the keystroke and refusing the value are different jobs — the pair
`maxLengthGuard`/`maxLength` is the same split — and a field usually wants both.

## Reading the validity without submitting

`useConstraintValidityState(ref)` gives the control's validity as it stands,
re-read whenever it changes:

```js
const state = useConstraintValidityState(inputRef);
state.valid; // false
state.single_space.messageString; // the sentence
state.reported; // "max_length" — the one the callout says
```

Several constraints fail at once and only one sentence is shown: the one with
the highest priority — an `error` status first, then `required`, then the
platform's own constraints, then navi's and the app's, ties going to the first
registered. `reported` names it, so a summary drawn beside the field says the
same thing as the callout rather than picking a second one.

`src/control/demos/validation/text_rules_demo.html` is that, one rule per row: a
value that breaks it, its message read live, and a submit to see the callout.

## Messages

Every sentence navi says is a key in `naviI18n`, and the validation ones are
`constraint.*`. An app changes one for its whole app by registering over it:

```js
import { naviI18n } from "@jsenv/navi";

naviI18n.add("constraint.single_space.consecutive", {
  fr: "Pas deux espaces d'affilée.",
});
```

The keys of everything validity owns are validity's own key prefixed with
`constraint.` — `single_space.start` is `constraint.single_space.start`,
`char_class.slug` is `constraint.char_class.slug`. That is deliberate: the
sentence a server returns and the sentence the field shows are looked up under
one name, so making them agree is registering one key, not maintaining a
translation table. See `src/control/rules/validity_bridge.js`, and `i18n.md` for
how the registry itself works.

## An app's own rules

An app puts its rules in the package its server reads too, and then decides, per
rule, who runs it.

**Both sides.** The rule is a validity rule; navi wears it as a constraint.

```js
// shared/src/text_rules.js — read by the server and by the front
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
```

```js
// front — once, at module level: a constraint rebuilt on every render is a new
// object on every check
import { constraintFromValidityRule } from "@jsenv/navi";

const MAX_WORDS_CONSTRAINT = constraintFromValidityRule(MAX_WORDS_RULE, {
  maxWords: 40,
});

<Textarea constraints={[MAX_WORDS_CONSTRAINT]} />;
```

The rule's key is looked up in `naviI18n` under `constraint.max_words`, so
register it there — or pass `formatMessage` beside the parameters to say it
through the app's own i18n instead.

**The server alone.** A rule needing the database, another user's data or a
secret stays in `createValidity({ rules })` and never reaches the front; its
refusal arrives with the response like any other error.

**The browser alone.** A rule about the gesture rather than the value — what a
keystroke may insert, a warning shown while typing — is a plain navi constraint,
written inline and never sent anywhere:

```js
<Input
  constraints={[(field) => (field.uiState === "admin" ? "Reserved" : null)]}
/>
```

`registerGlobalConstraint(constraint)` is the same thing for every control at
once, for a rule that genuinely holds everywhere in the app.

The line to hold across all three: **the front may be laxer than the back, never
stricter**. A value the field accepted and the server refuses is a promise
broken after the fact — which is exactly what happens when the same rule is
written twice and the copies drift.
