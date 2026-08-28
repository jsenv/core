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
ascent/descent than any text font, and under `line-height: normal` a line box
takes the height of the tallest font it holds. So the moment an emoji sits in a
line, that line is taller than the ones around it: a row shifts down next to its
neighbours, a paragraph's lines are unevenly spaced, a truncated label no longer
lines up with its siblings. Tighten the line to get the rows even again and the
glyph is clipped instead — its box is taller than a letter's, and what sticks
out is simply cut.

**One number answers both: `--navi-line-height`, 1.25.** Tall enough to contain
an emoji's own box, so nothing is clipped; tight enough that a line carrying one
is exactly as tall as a line of plain text, so nothing moves. 1 cuts the top off
the glyph, 1.5 spaces the rows out more than reading them asks for. **An app
that displays what people typed cannot go below 1.25** — that is the floor this
token encodes, and the reason it is a token rather than a number repeated in
every component.

**Everything is written on that line, controls included.** The document sets it
on `:root`, and the components that would otherwise come with a line of their
own from the browser — `Button`, `Input`, `Textarea`, `Select` — are handed it
by name: a form control inherits nothing from the page on its own, and what it
starts from is `normal`, the one value the emoji breaks. That is what makes a
value keep its line, and its emoji its size, as it passes from the field it was
typed in to whatever displays it afterwards — an emoji typed in an input is not
clipped, and the same emoji displayed in a row, a bubble or a button does not
push anything around. `text_emoji_demo.html` shows it by swapping the field and
the rendering in place.

A control takes it snapped to the pixel (`--navi-control-line-height`,
`round(1.25em, 1px)`). The browser lays a line out at its exact height but
paints the glyph on a pixel row, and at the default control size (13.333px)
the line is 16.666px: the two-thirds that do not fit go entirely under the
glyph, which then sits a pixel above the middle of its field — the placeholder
looks too high. A whole number of pixels has no remainder to put anywhere, and
a `Textarea` sized in `lh` lands on the same grid as the placeholder it
measures. The page's text keeps the plain number: a length would stop
following the font size the moment it is inherited.

Change it on `:root` for a whole app. Do not unset it on a component, do not let
one fall back to `normal`, and do not raise a local `lineHeight` because of an
emoji: a `lineHeight` is a typographic choice for the text itself — a paragraph
that wants air — never a workaround for a glyph that grew too tall.

**Where an emoji belongs is a separate question, and it is not a layout one.**
A field can still refuse emoji outright (`noEmoji`) where the value is an
identifier rather than free text. A name is the case worth stating: people are
called what they are called, and a whitelist on a name field ends up refusing
somebody's real name — a name field keeps to the rules that are about what can
be drawn at all (`data-displayable`: marks stacked into zalgo, a value that
shows nothing, blank lines in series).

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
