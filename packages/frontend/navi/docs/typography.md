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

`color` takes five keywords, and they are how a text says how loud it is:

```jsx
<Text color="primary">the ink of the paper, at full strength</Text>
<Text color="secondary">supporting text, captions, less important labels</Text>
<Text color="emphasis">reinforced, standing out from what surrounds it</Text>
<Text color="discrete">there, not competing for attention</Text>
<Text color="hint">barely there — watermarks, ghost placeholders</Text>
```

Four of the five are formulas on `currentColor`, so they follow whatever ink
their container writes in — a dark card sets `color` and nothing else. Never
read the `--navi-color-*` variable behind a keyword with `var()`: the keyword is
the name, and an invented one (`var(--navi-text-color-discrete)`) resolves to
nothing and silently inherits. Declare one only to pin a container's paper —
what the ratios are, how a theme changes them and why a surface re-declares
them: [css_architecture.md](./css_architecture.md#ink-ratio-paper-the-color-keywords).

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
`Box` style props, mapped one-to-one to CSS for an element that is not a `Text`.
`maxLines` also states the `white-space` its line count needs — one line does
not wrap, n lines may — and that is what makes it hold anywhere: `white-space`
is inherited, and a raw clamp put under a single-line ancestor — a `Picker`'s
value, a `Time` — inherits `nowrap`, gets one line to cut, and lets the text run
past its box instead. An explicit `noWrap`/`pre`/`preLine` beside `maxLines`
still wins.

The prop is the same wherever it is taken — a `Picker`'s value (1 by default),
a `Spin`'s value, `Binder`'s tab labels, a `BadgeList`'s rows (see
[BadgeList](#badgelist)); `Badge` is `maxLines={1}` by construction. On a plain
`Box`, `maxLines` is the raw CSS mapping: it clamps whatever the box holds, and
states nothing else.

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
overflowing its container. Same shape for a count, a badge or a status kept to
the right of the ellipsis: a sibling with `shrink={false}`.

A flex or grid item refuses to become narrower than its content unless it is
told it may. `maxLines` sets `min-width: 0` on the `Text` itself, but **every
`Box` between it and the element that actually has a width must say it too**,
or the whole chain grows instead of truncating:

```jsx
<Box flex width="300" spacing="s">
  {/* without minWidth the row just grows */}
  <Box flex expandX minWidth="0">
    <Text maxLines={1}>…</Text>
  </Box>
</Box>
```

### The text wraps — the end icon must not be left alone

No truncation here: the text is allowed to take several lines. The trap is the
last child. An icon (or a unit, or an arrow) is an atomic inline, so the browser
is free to break the line right before it — and no character can prevent that;
a word joiner does not suppress a break before an atomic inline. On the wrong
container width, the icon ends up alone on a line under the label.

`attachLastChild` fixes it: the last child and the **last word** before it are
put in one `white-space: nowrap` box — only the last word, since wrapping the
whole preceding text would stop a long label from wrapping at all.

```jsx
<Text attachLastChild>
  A title long enough to wrap onto several lines
  <Icon>
    <ExternalSvg />
  </Icon>
</Text>
```

`Link` does this on its own whenever it renders an end icon (`endIcon`,
`anchorIcon`, the external-target one). Write `attachLastChild` yourself when
you build such a pair outside `Link`.

## Spacing between children

`Text` injects a separator between its children whenever at least one side is an
element — an icon and a label are spaced without a manual `{" "}` — and
`spacing` changes it. Two things opt out of that flow:
`markAsOutsideTextFlow(Component)`, for something rendered inside a `Text` that
takes no room in the line (an absolutely positioned indicator, an overlay),
where a separator would leave a stray gap next to something invisible; and
`preventSpaceUnderlines`, which `Link` sets, so an underline stops at the text
instead of running under the spaces.

## Emoji

**An emoji is not a character the layout can absorb.** The system emoji fonts
have a taller ascent/descent than any text font, and under `line-height: normal`
a line box takes the height of the tallest font it holds. So the moment an emoji
sits in a line, that line is taller than the ones around it: a row shifts down
next to its neighbours, a paragraph's lines are unevenly spaced. Tighten the
line to get the rows even again and the glyph is clipped instead.

**One number answers both: `--navi-line-height`, 1.25.** Tall enough to contain
an emoji's own box, so nothing is clipped; tight enough that a line carrying one
is exactly as tall as a line of plain text, so nothing moves. 1 cuts the top off
the glyph, 1.5 spaces the rows out more than reading them asks for. **An app
that displays what people typed cannot go below 1.25** — that is the floor this
token encodes.

**Everything is written on that line, controls included.** The document sets it
on `:root`, and the controls that would otherwise start from the browser's
`normal` — the one value the emoji breaks — are handed it by name: `Button`,
`Input`, `Textarea`, `Select`, and `Picker` and selectable `List` items, which
stand in a row with them. A form control inherits nothing from the page on its
own. So a value keeps its line, and its emoji its size, from the field it was
typed in to whatever displays it afterwards (`text_emoji_demo.html`).

A control takes it snapped to the pixel (`--navi-control-line-height`,
`round(calc(var(--navi-line-height) * 1em), 1px)`): a fractional line puts its
remainder under the glyph, which then sits a pixel above the middle of its
field. The page's text keeps the plain number, which follows the font size when
inherited.

Change it on `:root` for a whole app. Do not unset it on a component, do not let
one fall back to `normal`, and do not raise a local `lineHeight` because of an
emoji: a `lineHeight` is a typographic choice for the text itself — a paragraph
that wants air — never a workaround for a glyph that grew too tall.

Where an emoji belongs is a separate question, and not a layout one: a field
refuses one with `noEmoji`, and a name field — people are called what they are
called — keeps to what can be drawn at all (`displayable`) rather than a
whitelist. See [field_validation.md](./field_validation.md#constraints).

## Text that must not move when its style changes

A label that becomes bold when its row is selected reflows everything around it.
`holdSpaceForStyle={{ fontWeight: "bold" }}` reserves the space with an
invisible copy in the target style — any style change, single-line only (best
with `noWrap`); `boldStable` handles weight only, on several lines. And
`shrinkWrap` for the reverse problem: an element wider than the longest line it
renders (a wrapped paragraph inside a flex or grid container) is pinned to that
line.

## Loading

`loading` renders a shimmering skeleton in place of the content; `skeleton` is
the same bar without the animation. The children stay in the DOM (hidden), so
the block keeps the size the real text will have — **pass the eventual text,
not a placeholder**, whenever it is known.

The bar is painted with the text's own ink, so it is seen on whatever paper it
lands on without being told what that paper is. Where the surrounding ink is the
wrong cue, `--skeleton-color` and `--skeleton-shimmer-color` (the moving band)
take it over; navi declares neither, so both can be set on the element or on any
container above it.

## BadgeList

A row of badges that wraps. A plain one costs nothing — one element holding its
children as they are; only `max`, `fallback`, `maxLines` and `shrinkWrap` count
or measure. Once the list has something to decide (`max`, `fallback`,
`maxLines`), a `Badge` inside it does not render itself: it hands its props to
the list, which draws it. Two consequences:

- a `Badge` must be a **direct** child of the list — `<div><Badge /></div>`
  takes the badge out of its wrapper;
- a badge's own `key` does not reach the badge the list draws, which is keyed
  by position: reordering recreates the nodes rather than moving them.

Inside a `Picker`, the rows are capped by the picker's `maxLines` (the picker
turns its own clamp off: line-clamp never sees a wrapped flex row), and `max`
composes with it — the `+N` badge takes one of the `max` slots. A picker given
a `ui` draws that and only that, never its `placeholder`, so an empty
`BadgeList` there is a blank picker: pass the placeholder text as the list's
`fallback`.

```jsx
<BadgeList fallback="Select skills…">
  {selected.map((skill) => (
    <Badge key={skill}>{skill}</Badge>
  ))}
</BadgeList>
```

Plain text is the right shape for it: it reads at the picker's own size, and the
box stays the same height empty and filled. It is drawn in the normal text
color, not the placeholder's — a caller's `ui` is never greyed as a placeholder.
