# Lifting: a card that comes to the front

`animation="lifting"` on a `Dialog` (and on a `Picker` in `mode="dialog"`) is
for one situation: the thing the user pressed is the thing the popup shows,
brought to the front to be looked at or written in. A card in a feed becomes
its edit sheet; a drawing in a corner becomes the drawing full width. The page
recedes behind a wall, the box leaves its place, travels and grows, and comes
back into its place on close.

It is not a way to open a dialog with a nicer entrance. A dialog that shows
something else than what was pressed — a menu, a confirmation, a form the
trigger only names — wants `"scaling"`, `"sliding"` or `"fading"`: those move
the dialog on its own box. Lifting morphs the trigger's box into the popup's,
and everything below follows from that one fact.

- [What is lifted is named](#what-is-lifted-is-named)
- [The trigger's box is the card's box](#the-triggers-box-is-the-cards-box)
- [Two kinds: a card, or a scene](#two-kinds-a-card-or-a-scene)
- [The lifted node paints itself](#the-lifted-node-paints-itself)
- [Same width, or a wider box](#same-width-or-a-wider-box)
- [What it costs, and where the time goes](#what-it-costs-and-where-the-time-goes)
- [The wall, and the frame before the movement](#the-wall-and-the-frame-before-the-movement)
- [What the browser does around it](#what-the-browser-does-around-it)
- [Measuring](#measuring)

## What is lifted is named

`data-lift` marks the one node that IS the trigger once in front: a node inside
the popup, or the popup itself when the whole dialog is that node. Nothing is
inferred: a dialog holding the lifted card plus a badge above and buttons below
lifts the card; a dialog that is the card wears `data-lift` itself.

```jsx
<Picker mode="dialog" animation="lifting" ui={<GameCard game={game} />} …>
  <Badge />
  <GameEditCard game={game} data-lift />
  <Buttons />
</Picker>
```

The opening waits for it. What a popup holds often arrives after the tap —
code fetched for the address, a row fetched for the popup — and a movement
started before the lifted node exists would carry the card into an empty box.
So the dialog is opened at once, held unpainted under a half-strength wall
(the card still readable beneath), and the lift starts the moment `data-lift`
is in the DOM. Past a second without it, the dialog is shown where it stands,
with no movement, and dev warns.

**Render the lifted node at once.** Waiting is a safety net, not the design: a
sheet whose card only exists once its data has landed pays that latency on
every opening. Render the card immediately from what the trigger already holds
(a read-only copy, a skeleton with the card's box), and let the fields fill in
inside it. `mount="from-first-open"` keeps it built across closes;
`mount="while-opened"` rebuilds it on every opening — the right choice for a
form seeded from a `defaultValue`, and the most expensive one (see
[costs](#what-it-costs-and-where-the-time-goes)).

## The trigger's box is the card's box

The movement starts from the trigger's box — the `Picker`'s root, or a
`Dialog`'s `anchor`. That box must be the card's: a trigger wider than the
card it shows (a bare picker stretched by a column flex, an `expandX` whose
`ui` does not fill it) starts the lift from a box the card does not fill. The
painted box then wears the card's width from the first frame while the card
sits in its corner, and the width never reads as changing. Measured on the
demo bench: the picker root at 364px around a 260px card.

Check it once, at rest: the picker root's `getBoundingClientRect()` equals the
card's. `variant="bare"` with a `ui` that is the card, in a container that does
not stretch it (`alignX="start"` on a column, or the trigger inline), is the
usual shape.

## Two kinds: a card, or a scene

`lift="box"` (default) is one object at two sizes — a card gaining fields, a
row becoming a sheet. Each picture keeps its own size, from the box's top-left
corner: the card's text does not zoom, the box gains room, and the picture of
what it became is uncovered as the box grows. The picture being left stays
whole for most of the way; the arriving one only shows near the end.

`lift="scene"` is one scene through two frames — a drawing enlarged. Both
pictures are drawn at the box's width and centred in it, so the content does
scale with the box, and a thumbnail lands on the middle of the whole at every
width.

Two traps, both about the thumbnail:

- **A scene under `lift="box"`** keeps the thumbnail at its own size in the
  corner of a growing, empty box, then swaps. Choose the kind by what grows:
  text and controls keep their scale (`box`), a drawing does not (`scene`).
- **A thumbnail that is not the scene framed.** `scene` assumes the thumbnail
  is either the whole drawing smaller, or a band cut from its middle as wide as
  it. A thumbnail letterboxed inside a box of another aspect ratio (an SVG
  `meet`-fitted into a 2:1 frame), or a crop taken off-centre, cannot land on
  the whole: the drawing seems to slide to one side, then reappear centred.
  Give the trigger's frame the scene's own aspect ratio, and crop from the
  middle if you crop.

## The lifted node paints itself

The moving box wears the lifted node's background and corners for the length
of the movement, so where the box has grown past the picture it carries, it is
the card that has grown. That paint is read off `data-lift` — and, when that
node paints nothing, off the first descendant that has its box and paints.

So a transparent wrapper around the card is fine, and a card whose colour
lives on a nested element of a different size is not: publish the colour on
the box that is the card. A gradient or an image travels as well
(`background-image`), a shadow does not.

## Same width, or a wider box

`dialogSizeFromAnchor` makes the trigger's box a floor for the dialog;
`dialogMaxWidth="var(--anchor-width)"` makes it the ceiling too. Together they
say "the same card, brought forward": the box travels and may grow in height,
never in width. Left out, `dialogExpandX` lets the sheet take the room it has,
and the width change is animated — the card keeps its scale inside a box
gaining room on the right, then the wider layout arrives.

Both read well; what does not is a box that is neither: a card whose width the
sheet changes by a few pixels for no reason the eye can name. Decide.

## What it costs, and where the time goes

Measured at CPU ×6 on the demo bench (`12_picker_card_demo.html#lift-bench`),
a card of a real edit sheet's weight (≈215 elements, 13 fields, 62 picker
nodes):

| opening                                     | tap → first moving frame |
| ------------------------------------------- | ------------------------ |
| the sheet rebuilt on every opening          | 355–416 ms               |
| the sheet already built (`from-first-open`) | 63–94 ms                 |
| a drawing (9 elements)                      | ≈140 ms                  |

Navi's own share of an opening — showing the dialog, placing it, the two
pictures — is the second line. Everything above it is the content: preact and
the components of the sheet, spread thin over ~100 components with no single
hot spot, plus `showModal()` and one layout. So the lever is the content:

- **Build less, or earlier.** A sheet that is the same across openings keeps
  `mount="from-first-open"`. A sheet that must be rebuilt (`while-opened`)
  pays its build on every tap; keep it as light as the page allows.
- **Do not rebuild by accident.** A sheet whose code or data is tied to the
  address (`?edit=<id>` driving a route action) is thrown away when the
  address clears and rebuilt through a `null` render on the next opening —
  `from-first-open` then rebuilds anyway. Keep the code loaded across closes,
  and seed the sheet from what the trigger holds.
- **Warm what a first opening creates.** Intl formatters (a day spin's labels)
  are created on the first opening and cached; a page that will lift a card
  can render one such label at idle.

The movement itself is the browser's, on the compositor: once it starts, the
content's cost is over. Measured per frame at ×6: ≈23 ms, the wall's fade
included.

## The wall, and the frame before the movement

The tap is answered on the frame the dialog opens, before the pictures are
taken: the wall is on screen at half strength, the card still readable under
it, and the lift starts from there — the wall completes over the movement.
That single frame lasts as long as the pictures take; with nothing left to
build it is 40–60 ms, with a sheet to render it is the sheet's build. Half
rather than nothing, because the first painted frame is the whole feedback of
a slow tap; half rather than full, because a full opaque wall erases the card
the movement is about to lift.

`animation="lifting"` brings its own wall — opaque and blurred
(`--navi-backdrop-lift-*`), the page it came out of being what the movement
leaves; `backdropVariant="discrete"` asks for the light wash back. See
`popup_backdrop.md`.

## What the browser does around it

- **The page is photographed too**, deliberately: a modal dialog and its wall
  live in the top layer, and the browser paints the top layer during a
  transition only as part of the root's picture — opted out, wall and dialog
  go unpainted for the length of the movement (Chrome 153, reproduced in a
  bare page; in an app it showed only past a few thousand pixels of scroll).
  The price is a page frozen and unpressable while the movement plays: under a
  modal wall at the opening, and a quarter of a second at the closing.
- **Fixed bars are named for the movement** (`navi-fixed-bar-0..3`), so the
  lifted box passes under them near the trigger — a thumbnail half under the
  top bar leaves from under it — and over them near the popup, where a tall
  dialog stands over the bars.
- **The closing is photographed whole**, the picture of the popup taken before
  the close takes it off screen. Escape, the wall, `--navi-close`, `navBack`
  all go through it; the native `cancel` of a `<dialog>` is prevented so the
  browser does not close it before the picture.
- **One lift at a time.** A document has one view transition; a lift started
  while another plays replaces it, and the replaced one is released cleanly.

## Measuring

Movement is measured, never eyeballed (see the animations skill). The bench in
`12_picker_card_demo.html#lift-bench` reports, per opening, tap → dialog open
and tap → first moving frame, plus a census of what the dialog holds, next to
the numbers of a real app's sheet; throttle the CPU in devtools to read a
phone's. A re-rasterized screenshot lies about a running transition: to see
what the screen shows, record a video (`recordVideo`, then frames through
ffmpeg) and, for a size, track the colour of the card frame by frame.
