# Typography (`<Text>` and friends)

What we want: **text is a component, not a tag.** Every string an app displays
goes through `Text` (or something built on it — `Title`, `Paragraph`,
`Caption`, `Code`, `Badge`, `Link`, a control's label). The reason is not
styling: it is that a line of text is rarely only text. It carries an icon, a
count, a unit, a loading state, a truncation, an anchor to click. Each of those
has exactly one correct spelling, and `Text` is where that spelling lives — so
that a screen written by one person and a screen written six months later break
lines, space icons and truncate the same way.

The corollary: when a piece of text does something the raw tag cannot express,
the answer is a `Text` prop, not CSS written beside it. If the prop does not
exist, it is missing from `Text` — that is where to add it.

```jsx
<Text>Hello</Text>                      // a span
<Text as="p">A paragraph</Text>         // any tag
<Title>A heading</Title>                // h1..h6, bold, spaced
<Caption>A discreet note</Caption>      // small, dimmed
```

`Text` accepts every `Box` prop (`color`, `size`, `padding`, `expandX`, …), so
there is never a `<div style>` wrapped around it just to place or color it.
`size` takes the typography tokens `xxs | xs | s | m | l | xl | xxl` (or any CSS
length); the spacing props take the spacing tokens of the same name. Two scales,
same names — `size="l"` is a font size, `padding="l"` is a gap.

Live examples: `src/text/demos/*_demo.html` — one page per concern
(`text_overflow_demo.html`, `text_spacing_demo.html`, `text_loading_demo.html`,
`text_attach_last_child_demo.html`, `text_emoji_demo.html`, `icon_demo.html`).

## Truncating: `maxLines`, and nothing else

**`maxLines` is the only prop to reach for when text must not exceed a given
height.** One prop covers both truncations, because from the call site they are
one decision — "how many lines am I allowed" — even though the browser
implements them with two unrelated mechanisms:

```jsx
<Text maxLines={1}>Truncated on one line, with an ellipsis…</Text>
<Text maxLines={3}>Up to three lines, then an ellipsis…</Text>
```

Do **not** write `lineClamp={1}`. `lineClamp` and `overflowEllipsis` are raw
`Box` style props: they map to `-webkit-line-clamp` and to
`overflow/text-overflow` one-to-one, and are there for the case where an element
is not a `Text` (or deliberately opts out of it) and still needs that CSS. They
know nothing about each other, so `lineClamp={1}` gives a single-line webkit box
without the single-line handling `maxLines={1}` brings — `maxLines` switches the
element to a block, sets `min-width: 0` on itself, and keeps `white-space`
sensible for the tag it renders (a `<p>` keeps its line breaks). On a `Text`,
`maxLines` is always the right answer.

### Truncation only happens if something says "you may shrink"

A flex or grid item refuses to become narrower than its content unless it is
told it may. `maxLines` sets `min-width: 0` on the `Text` itself, so the leaf is
covered — but **every `Box` between it and the element that actually has a
width must say it too**, or the whole chain grows instead of truncating:

```jsx
<Box flex width="300" spacing="s">
  <Box flex expandX minWidth="0">
    {" "}
    {/* without minWidth the row just grows */}
    <Text maxLines={1}>…</Text>
  </Box>
</Box>
```

Symmetrically, whatever must keep its full size says so with `shrink={false}`.
A row where the text gives way and nothing else does is the normal shape — see
the recipes below.

## A row: icon, text, icon

Two rows that look alike on screen and are built the opposite way. Which one you
want is decided by a single question: **when there is not enough room, does the
text truncate or does it wrap?**

### The text truncates — the end icon stays visible

Anything that must survive truncation lives **outside** the truncating `Text`,
as a sibling in a flex row. Inside, it would be eaten by the ellipsis like any
other character.

```jsx
<Box flex spacing="s" alignY="center" width="300">
  <Icon shrink={false}>
    <StarSvg />
  </Icon>
  <Text maxLines={1} expandX>
    A label long enough that it has to be cut before the trailing icon goes
  </Text>
  <Icon shrink={false}>
    <ChevronSvg />
  </Icon>
</Box>
```

The three parts of it, and each is load-bearing: `shrink={false}` on the icons
(they are the fixed part), `expandX` on the text (it is the part that gives),
`maxLines={1}` (what giving way means for text). Drop any one and the row fails
in a different way — icons squashed, ellipsis never appearing, or the row
overflowing its container.

Same shape for a count, a badge or a status kept to the right of the ellipsis:
it is a sibling with `shrink={false}`, not a child of the truncating text.

### The text wraps — the end icon must not be left alone

No truncation here: the text is allowed to take several lines. The trap is the
last child. An icon (or a unit, or an arrow) is an atomic inline, so the browser
is free to break the line right before it — and no character can prevent that; a
word joiner does not suppress a break before an atomic inline. On the wrong
container width, the icon ends up alone on a line under the label.

`attachLastChild` fixes it: the last child and the **last word** before it are
put in one `white-space: nowrap` box, the classic widow fix applied to the one
place where breaking is always wrong.

```jsx
<Text attachLastChild>
  A title long enough to wrap onto several lines
  <Icon>
    <ExternalSvg />
  </Icon>
</Text>
```

Only the last word travels with the child — wrapping the whole preceding text
would stop a long label from wrapping at all.

`Link` does this on its own whenever it renders an end icon (`endIcon`,
`anchorIcon`, the external-target one), which is why a document's table of
contents never drops an arrow on a line of its own. Write `attachLastChild`
yourself when you build such a pair outside `Link`.

## Spacing between children

`Text` injects a separator between its children whenever at least one side is an
element — so an icon and a label are spaced without a manual `{" "}`, and two
plain strings are left alone. `spacing` changes it: a size token (`"s"`, `"m"`,
…), a CSS length, a number (px), a string used verbatim, or `"pre"` / `0` to
inject nothing.

Two things opt out of that flow:

- `markAsOutsideTextFlow(Component)` — for something rendered inside a `Text`
  that takes no room in the line (an absolutely positioned indicator, an
  overlay). Without it, a separator is injected next to something invisible and
  leaves a stray gap.
- `preventSpaceUnderlines` — inside an `<a>`, browsers draw the underline under
  the space characters too. This replaces them with padding-based spaces, so the
  underline stops at the text. `Link` sets it.

## Emoji

**An emoji is not a character the layout can absorb.** The system emoji fonts
(Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji) have a taller
ascent/descent than any text font, so the moment an emoji sits in a line, that
line is taller than the ones around it: a row shifts down next to its
neighbours, a paragraph's lines are unevenly spaced, a truncated label no
longer lines up with its siblings.

So, first: **an emoji is only expected in free text a user typed** — a message,
a comment, a description. It has no business in a title, an identifier, a
label, and a field holding one of those can refuse it outright rather than
teaching every row of the app to survive it.

A name is the exception worth stating: people are called what they are called,
and a whitelist on a name field ends up refusing somebody's real name. An app
taking that side puts `emojiAsIcon` on everything that renders a name, and
keeps the name field itself to the rules that are about the layout rather than
the alphabet — `data-displayable`, which refuses only what cannot be drawn:
marks stacked into zalgo (the one thing `emojiAsIcon` does not rescue, since it
draws over the row above), a value that shows nothing at all, blank lines in
series.

Where it is expected, `emojiAsIcon`:

```jsx
<Text emojiAsIcon>Salut 👋 on se retrouve au parc 🌳 ?</Text>
```

Every emoji found in the string children is rendered inside an `Icon`, which
gives it a box of its own and centers it on the line like any glyph icon — the
line keeps the height of its text, on one line or several. This is what chat
apps do (an emoji is a box in the line, never a glyph with its own metrics).
`Button` and `MessageBox` have it on by default — a label is one line whose height
everything around it relies on, a message is free text; `Badge` forwards it,
opt-in.

**That box is smaller than the text around it** — `--navi-emoji-size`, `xs`
(12px) by default. An emoji glyph fills its box edge to edge where a letter only
fills its x-height, so at the same font size it draws as an image dropped into
the sentence rather than as one of its characters. The var is the app-wide
lever, a theme decision like a color: a page wanting bigger emoji sets it once
on `:root`. `emojiAsIcon={{ size: "0.8em" }}` is the same decision for one text
only — an object instead of `true` is the props the `Icon` receives, and a
relative length there stays tied to the text it sits in where the typo tokens
(`xs`, `s`) are fixed in rem.

**It does not go through a component.** Only the strings the `Text` itself
receives are rewritten, so `<Text emojiAsIcon><UserName /></Text>` does
nothing at all: the string is inside `UserName`, and that is where
`renderEmojiAsIcon()` has to be called. Doing it there also spares a `Text`
that would inject a separator between the name and whatever follows it.

There is no way to turn it on for a whole app, on purpose: most of an app's
text is its own wording, where an emoji cannot appear, and the ones that do
carry a typed value are known one by one. An app that renders such a value
everywhere writes its own component around `Text` — the same place it already
decides how a name is displayed.

What it does not do, and that is accepted: under `maxLines` the `Text` clips at
its own box — that is what truncation is — and an emoji drawn a little beyond
its 1em box can lose a sliver at the top. The line stays aligned, which is the
part that matters.

**Do not raise `lineHeight` because of emoji.** The default line height keeps
text compact and, with `emojiAsIcon`, holds up even when nearly every word is
an emoji (see the dense cases in `text_emoji_demo.html`). A `lineHeight` is a
typographic choice for the text itself — a paragraph that wants air — never a
workaround for a glyph that grew too tall; that glyph gets `emojiAsIcon`.

**A control one types in is the exception, and there the line height is the
whole answer.** `emojiAsIcon` rewrites strings into markup, and there is no
markup inside a `<textarea>` or an `<input>`: the value is raw text the browser
draws itself, so no glyph in it can be wrapped in anything. Under
`line-height: normal` a line box takes the height of the tallest font it holds,
so the one line carrying an emoji stands taller than the ones around it — rows
of uneven height, and a box sized in `lh` (`minRows`/`maxRows`) that jumps as
soon as one is typed.

**So there is one line for everything: `--navi-line-height`, 1.25.** A number
rather than `normal`, tall enough to hold an emoji's own box without clipping it
and tight enough not to space the rows out — 1 cuts the top off the glyph, 1.5
reads as a paragraph. The document is written on it, and the fields are handed
it by name (`Input`, `Textarea`, `Select`) because a form control inherits
nothing from the page on its own. One number everywhere is what makes a value
keep its line — and its emoji its size — as it passes from the field to what
displays it. Change it on `:root` for a whole app; do not unset it on a field,
and do not let one fall back to `normal` (`34_textarea_demo.html` shows what
that costs). The rule above still holds everywhere the text is rendered rather
than typed.

The price of that exception is a visible jump: what is typed draws at the font
size of the field, and the same value displayed afterwards draws its emoji at
`--navi-emoji-size` — the glyph shrinks the moment the field is left.
`text_emoji_demo.html` puts the field and the rendering next to each other, and
swaps one for the other in place, to show how much it costs; the alternative
being an emoji that makes every line it lands on taller, it is the side worth
taking.

## Text that must not move when its style changes

A label that becomes bold when its row is selected reflows everything around it.
Two answers, and the one to pick depends on whether the text wraps:

- `holdSpaceForStyle={{ fontWeight: "bold" }}` — an invisible copy rendered in
  the target style reserves the space; the visible text is layered on top. Handles
  any style change (weight, size), single-line only. Best with `noWrap`.
- `boldStable` — paints normal-weight text over a bold background clipped to the
  glyphs. Works on several lines, handles weight only.

And `shrinkWrap` for the reverse problem: an element whose box is wider than the
longest line it actually renders (a wrapped paragraph inside a flex or grid
container). It measures and pins the width to that longest line.

## Loading

`loading` renders a shimmering skeleton in place of the content; `skeleton` is
the same bar without the animation. The children stay in the DOM (hidden), so
the block keeps the size the real text will have — pass the eventual text, not a
placeholder, whenever it is known.
