# Field validation

What a control refuses, who decides it, and what is left for a server to say.

## The split

A control refuses a value for two very different kinds of reason, and keeping
them apart is the whole subject.

**What only a browser can answer.** A keystroke blocked before the value exists,
a callout placed next to the field, `required` on a radio group, `data-one-of`
reading an option list out of the document, the moment a message appears
(typing? blur? submit?). This is navi's, and it stays navi's.

**« Is this value acceptable ».** A length, a set of allowed characters, a
value that renders nothing, a business rule. This is not a DOM question — a
server asks the same one about the same value — so it lives in
[@jsenv/validity](../../../tooling/validity/README.md) and navi consumes it.

The consequence that matters when writing an app: **do not write a constraint
for something a rule already answers**. If the sentence you are about to write
in a `check()` would make sense in a server's response, the knowledge belongs in
a validity rule, and the constraint is only its browser-side caller.

## Constraints

A constraint is `{ name, check(field) }` — a bare `check` function is accepted
too. `check` returns `null` when the value passes, or the message to show — a
string, or `{ message, target }` when the callout belongs on another element
than the control itself.

Navi's own constraints are switched on by an attribute on the control —
standard when the platform has one, `data-*` when it does not. **They are
written as props, in camelCase**, which land on the control host as the
attribute the constraint reads — the conversion `element.dataset` does:
`singleSpace` is what you write, `data-single-space` is what ends up in the DOM
(the devtools, a test selector). The attribute form is accepted too, for a
control written in plain HTML.

| prop                            | attribute                                   | refuses                                                                         |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `required`, `pattern`           | same                                        | what the platform's attributes mean                                             |
| `minLength`, `maxLength`        | same                                        | a string too short or too long                                                  |
| `min`, `max`, `step`            | same                                        | a number, date, time or duration out of range, or off its step                  |
| `singleSpace`                   | `data-single-space`                         | a leading or trailing space, two in a row                                       |
| `displayable`                   | `data-displayable`                          | zalgo, a value showing nothing, blank lines in series, a joiner joining nothing |
| `maxStackedMarks`               | `data-max-stacked-marks`                    | (parameter of `displayable`)                                                    |
| `noEmoji`                       | `data-no-emoji`                             | an emoji, where a name, an identifier or a title does not want one              |
| `maxLineBreaks`                 | `data-max-line-breaks`                      | a value holding more line breaks than that                                      |
| `oneOf`                         | `data-one-of`                               | a value outside the option list its CSS selector points at                      |
| `sameAs`                        | `data-same-as`                              | a value differing from the field its CSS selector points at                     |
| `minDigit`, `minUpperLetter`, … | `data-min-digit`, …                         | a password missing a kind of character                                          |
| `minDuration`                   | `data-time-after`, `data-time-min-duration` | a `TimeRangeSpin`/`TimeRangeWheel` span ending before it starts, or too short   |

```jsx
<Input required singleSpace noEmoji maxLength={80} />
<Textarea displayable singleSpace maxLineBreaks={4} />
```

A boolean switch (`displayable`, `singleSpace`, `noEmoji`) passed as `false` is
off, so `noEmoji={settings.strictNames}` says what it looks like it says. The
others carry a value — a count, a selector — and are off by being absent.

**`singleSpace="autoFix"` corrects the value instead of refusing it.** A text
field ends with a space more often than anyone means it to — a pause after a
word, a mobile keyboard after a suggestion, a paste — and a refusal then asks
the person to find and delete a character they cannot see. With `"autoFix"`,
the leading and trailing spaces are removed and a run of spaces becomes one:

```jsx
<Input name="title" singleSpace="autoFix" />
```

- **At commit, never while typing**: when the field is left, and before an
  action reads the value. Correcting on each keystroke would eat the space the
  person is about to follow with a word, so an action run from typing (a
  search, debounced or not) reads the value as typed.
- **Nothing to say**: the correction is validity's own rule, so no callout, and
  a server re-checking with `singleSpace: true` accepts what it receives.
- **It lands everywhere the value lives** — the field, its ui state, the bound
  `signal` — except in a `disabled` or `readOnly` field, whose value is the
  app's and not the person's.
- **`singleSpace` is the only constraint that offers it**: a correction is worth
  it only where it cannot change what the person meant, which a `maxLength`
  silently cutting a text would.

Most constraints take a `<name>Message` prop to replace their sentence for one
field (`requiredMessage`, `singleSpaceMessage`, `oneOfMessage`…; `step` and the
time span constraints have none). To change it everywhere, override the i18n
key instead — see [Messages](#messages).

Two props sit beside them and belong to the browser alone, because they act
before there is a value to validate: `charGuard` blocks a keystroke that is not
in its character class (or one of validity's preset names: `charGuard="tel"`,
`"slug"`, `"noEmoji"`), `maxLengthGuard` blocks the one that would overflow and
truncates a paste. Both show what they refused in a callout rather than
silently swallowing it. Refusing the keystroke and refusing the value are
different jobs, and a guard brings the value check along: `maxLengthGuard` is
checked at submit as `maxLength`, `charGuard` sets an `Input`'s `pattern` from
its class unless one is given. `maxLength` alone is the submit-only half.

**A guard answers for the gesture, never for what the field already holds.** A
value can arrive already outside the class or already too long — a
`defaultValue`, a signal, a value written from elsewhere — and a guard that
re-judged the whole value would refuse every keystroke over it, blaming the
person for a character they did not type, and refuse the deletion that would
have fixed it. So a change is refused only when it makes the value worse. What
is already there is the constraint's business, and it says so at submit.

## Reading the validity without submitting

`useConstraintValidityState(ref)` gives the control's validity as it stands
(see its JSDoc). When several constraints fail at once, only one sentence is
shown: the one with the highest priority — an `error` status first, then
`required`, then the platform's own constraints, then navi's and the app's, ties
going to the first registered. `reported` names it, so a summary drawn beside
the field says the same thing as the callout rather than picking a second one.

`src/control/demos/validation/text_rules_demo.html` is that, one rule per row: a
value that breaks it, its message read live, and a submit to see the callout.

## Messages

Every sentence navi says is a key in `naviI18n`, and the validation ones are
`constraint.*`. An app changes one for its whole app by registering over it:
`naviI18n.add("constraint.single_space.consecutive", { fr: "…" })`.

The keys of everything validity owns are validity's own key prefixed with
`constraint.` — `single_space.start` is `constraint.single_space.start`,
`char_class.slug` is `constraint.char_class.slug`. That is deliberate: the
sentence a server returns and the sentence the field shows are looked up under
one name, so making them agree is registering one key, not maintaining a
translation table. See [i18n.md](./i18n.md) for how the registry itself works.

## An app's own rules

An app puts its rules in the package its server reads too, and then decides, per
rule, who runs it — see validity's
[Rules of your own](../../../tooling/validity/README.md#rules-of-your-own) and
[Front and back](../../../tooling/validity/README.md#front-and-back-sharing-what-is-worth-sharing).
The navi side:

**Both sides.** The rule is a validity rule; navi wears it as a constraint,
built once:

```js
// front — once, at module level: a constraint rebuilt on every render is a new
// object on every check
import { constraintFromValidityRule } from "@jsenv/navi";

const MAX_WORDS_CONSTRAINT = constraintFromValidityRule(MAX_WORDS_RULE, {
  maxWords: 40,
});

<Textarea constraints={[MAX_WORDS_CONSTRAINT]} />;
```

The rule's key is looked up in `naviI18n` under `constraint.<key>`
(`constraint.max_words`), so register it there — or pass `formatMessage` beside
the parameters to say it through the app's own i18n instead.

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
