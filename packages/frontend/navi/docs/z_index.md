# Stacking (z-index)

What we want: **an element that must paint in front of another one, without
that decision reaching anything else on the page.** A `z-index` written without
a stacking context does the opposite — it is a claim against the whole
document, so a card's own detail ends up in front of the top bar.

Reach for the tools in this order.

## 1. DOM order first

Between positioned elements that all have `z-index: auto`, the last one written
paints in front. Moving a tag is the cheapest way to reorder, and it can never
affect anything outside its parent (see
[the card at the end](#a-card-that-stacks-three-layers-with-no-z-index)).

If the element that must be in front cannot move in the DOM (it is a slot, it
is written by a consumer), that is a real reason to go further — "I did not
think about the order" is not.

## 2. A `z-index` without a stacking context is compared against the page

`z-index: 5` does not mean "in front of my siblings". It means "in front of
everything painted lower **in the nearest stacking context**", and when no
ancestor opens one, that context is the document root — including `FixedBar`,
sticky list-group labels, and popups. That is how a small `z-index` inside a
card wins against a bar written at the other end of the page.

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
An app writing its own number without it is competing with navi's scale (§5).

## 4. What creates a stacking context without you asking

`opacity` below 1, `transform`, `filter`, `backdrop-filter`, `will-change`,
`contain: paint`, `mix-blend-mode`, and a positioned element with a `z-index`
other than `auto` all open one: something you faded or moved suddenly paints as
a block, and a `z-index` written deeper inside stops reaching where you
expected. The answer is still DOM order — write the layer that must be on top
last — not a `z-index` "to repair it": adding one on top of an unnoticed
stacking context is how a value ends up tuned to a symptom.

## 5. The values navi plays with

They live in `src/navi_z_indexes.js`, as tokens, in bands a decade apart — one
can grow without reaching the next, and a value seen in devtools says which
band it came from. From the bottom:

1, 2, 3 (a `Group` member hovered, focused, holding a popup open) < 10 (sticky
parts, while something scrolls under them) < 100 (`FixedBar`) < 1000
(`Dialog`/`Popover` with `layer="local"` and their backdrops, plus stack order)
< 10000 (a modal's wall painted into the page for the length of a route
transition, standing in for the top layer) < the top layer itself
(`Dialog`/`Popover` with `layer="top"`, callouts).

**The order matters more than the numbers.** A bar is above anything the page
scrolls, a popup above the bar, and a control raising itself above its
neighbour is at the bottom — a hovered control crossing the top bar is the bug
the gaps exist to make impossible. **A z-index that only orders a component's
own parts stays a literal** next to the rule that needs it (`Table` orders its
sticky cells, drag and resize on a 1–7 scale of its own).

### A sticky part is only in the band while it is stuck

`--navi-z-index-sticky` says "kept stuck while something scrolls under it", and
the second half of that sentence is a condition. A `List` group label at rest
is a block in the flow: nothing passes under it, and painting it at 10 there is
what slices a focus ring, a badge or a stamp that a neighbouring row lets out of
its box — including a `Group` member raising itself to 1, 2 or 3.

An element cannot read its own stuck state in CSS, so `List` measures it and
marks its header, footer and group labels `navi-stuck`: the band applies there,
`auto` at rest. That puts the decision back within reach of an app — a card
whose badge overflows into the label below it gets past it with a literal in
the card, against its own neighbour, exactly as §1–3 ask:

```jsx
// Reaches past a label at rest (auto), loses to one that is stuck (10).
<Stamp style={{ position: "absolute", bottom: "-12px", zIndex: 1 }} />
```

For what a literal cannot reach, each part has a pair of variables —
`--list-header-z-index`, `--list-footer-z-index`, `--list-group-label-z-index`,
each with a `-stuck` counterpart defaulting to the band — settable on `<List>`.
Reach for them last, and remember a negative value is compared against the page
like any other: without a stacking context between the label and the nearest
opaque background, `-1` does not put the label behind the rows, it puts it
behind that background and out of sight. See the "Sticky parts" chapter of
[12_list_demo.html](../src/control/demos/12_list_demo.html).

`Box`'s own sticky `header`/`footer` — the shape without a `body`; beside a
body they are plain blocks — and `<Box sticky>` take the opposite default: they
are in the band **always**, not only while stuck. A `Box` cannot tell: it is
the generic scrolling area, its content is whatever the app puts in it, and a
sticky part at `auto` loses to anything that content positioned, a `transform`
or an `opacity` below 1 included. The scrolling box is `isolation: isolate`, so
the band stays local to it. At the one call site that knows nothing inside is
positioned — a badge or a stamp overflowing a row is otherwise sliced by a
header it never scrolls under — `--box-header-z-index: auto`
(`--box-footer-z-index` likewise) writes it back.
[9_scrollable_z_index_demo.html](../src/box/demos/9_scrollable_z_index_demo.html)
shows the band, what `auto` would look like, and what the band costs, side by
side.

`<Box sticky>` carries the band from the prop itself. Without it, a `Group`
member holding focus (2) would be seen crossing a submit bar the box was written
to keep last, and neither DOM order nor `isolation` can answer that: 2 beats
`auto` whatever the order, and the common parent holds both. An explicit
`zIndex` wins, `"auto"` included:

```jsx
// Back to auto: this one is meant to slide under the card that follows it.
<Box sticky top zIndex="auto" />
```

### Why a `Group` member is not isolated

`Group` overlaps its members by one border width, so the one the user is on has
to paint over its neighbour — otherwise its focus ring is sliced in half by the
member that comes after it in the DOM. DOM order cannot express "whichever one
is hovered", so this is a legitimate `z-index`.

`isolation: isolate` on the group would contain those values, but it would
also contain the popup of a `Picker` held in the group when that popup stacks
in the page (`popupLayer="local"`): its 1000 would become local, and the popup
would be capped inside the group instead of covering the page. A top-layer
popup, the default, escapes any stacking context. So the group is deliberately
not isolated, and what keeps its 1, 2 and 3 harmless is the scale above them.

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
is there for what the card's children may do later, not for this example.
