# Stacking (z-index)

What we want: **an element that must paint in front of another one, without
that decision reaching anything else on the page.** A `z-index` written without
a stacking context does the opposite — it is a claim against the whole
document, so a card's own detail ends up in front of the top bar.

Reach for the tools in this order.

## 1. DOM order first

Between positioned elements that all have `z-index: auto`, the last one written
paints in front. Moving a tag is the cheapest way to reorder, and it can never
affect anything outside its parent.

```jsx
// The stamp paints over the content because it comes after it. No z-index.
<Box position="relative">
  <CardContent />
  <Stamp />
</Box>
```

If the element that must be in front cannot move in the DOM (it is a slot, it
is written by a consumer), that is a real reason to go further — "I did not
think about the order" is not.

## 2. A `z-index` without a stacking context is compared against the page

`z-index: 5` does not mean "in front of my siblings". It means "in front of
everything painted lower **in the nearest stacking context**", and when no
ancestor opens one, that context is the document root — including `FixedBar`,
sticky list-group labels, and popups.

This is the failure that keeps happening: a small `z-index` inside a card wins
against a bar written at the other end of the page, because both are competing
in the same, page-wide context.

## 3. If a `z-index` is genuinely needed, isolate

`isolation: isolate` on the common parent makes its descendants' `z-index`
values local to it — they order among themselves and the parent as a whole
takes its place among its own siblings.

```css
.my_card {
  /* z-index values inside the card mean "inside the card" */
  isolation: isolate;
}
```

A `z-index` inside a reusable component without this is a bug waiting for its
call site: the component behaves differently depending on where it is dropped.

## 4. What creates a stacking context without you asking

`opacity` below 1, `transform`, `filter`, `backdrop-filter`, `will-change`,
`contain: paint`, `mix-blend-mode`, and a positioned element with a `z-index`
other than `auto` all open one. Two consequences:

- something you faded or moved suddenly paints as a block, in front of or
  behind a sibling it used to interleave with;
- a `z-index` you wrote deeper inside stops reaching where you expected,
  because one of these ancestors now caps it.

The answer is still DOM order — write the layer that must be on top last —
not a `z-index` "to repair it". Adding one on top of an unnoticed stacking
context is how a value ends up tuned to a symptom.

## 5. The values navi plays with

| What                                                        | Value                                         | Notes                                                                                                                                                                         |
| ----------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top layer (`Dialog`/`Popover` with `layer="top"`)           | above everything                              | Browser top layer — no `z-index` involved, nothing in the page can beat it                                                                                                    |
| `Dialog`/`Popover` with `layer="local"`, and their backdrop | `--navi-popup-z-index` (1000) `+ stack order` | The stack order increments per open, so the last opened wins                                                                                                                  |
| Callout (validation messages)                               | `--callout-z-index` (1000)                    |                                                                                                                                                                               |
| `FixedBar`                                                  | 1                                             | `position: fixed` — it opens its own stacking context, but competes in the root one at 1, which is exactly why a stray `z-index: 2` anywhere on the page lands in front of it |
| `List` sticky group labels, `List` footer                   | 1                                             | Local to the list                                                                                                                                                             |
| `Table` (sticky cells, drag, resize)                        | 1–7, see `src/control/table/z_indexes.js`     | Derived from each other, never literals                                                                                                                                       |

Two things to read from this table:

- navi itself keeps its values low and relative, except for popups, which sit
  at 1000 precisely so nothing has to guess;
- an app that writes a number above 1 is already competing with `FixedBar`.
  Write `isolation: isolate` on the parent instead, and the number stops
  meaning anything outside it.

## A card that stacks three layers with no `z-index`

A cover link that makes the whole card clickable, content above it, and a stamp
above everything — DOM order alone, in painting order:

```jsx
<Box relative isolation="isolate">
  {/* Painted first, fills the card, catches the clicks */}
  <Link href={href} absolute inset aria-label={title} />
  {/* After it, so text and buttons are on top and remain interactive */}
  <Box relative>
    <Text bold>{title}</Text>
    <Text>{description}</Text>
  </Box>
  {/* Last, so it covers the two others */}
  <Stamp />
</Box>
```

The only positioning trick here is `position: relative` on the content: a
positioned element paints above a non-positioned one regardless of order, so
the content has to be positioned too to stay above the cover link. `isolation`
is there for what the card's children may do later, not for this file.
