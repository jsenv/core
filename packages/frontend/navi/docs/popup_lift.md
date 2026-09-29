# Lifting: a card that comes to the front

`animation="lifting"` on a `Dialog` (and on a `Picker` in `mode="dialog"`) is
for one situation: the thing the user pressed is the thing the popup shows,
brought to the front to be looked at or written in. A card in a feed becomes its
edit sheet; a drawing in a corner becomes the drawing full width. The page
recedes behind a wall, the box leaves its place, travels and grows, and comes
back into its place on close — or, with
`animation={{ open: "scaling", close: "lifting" }}`, only lands somewhere on
close (see [lifting on the way back only](#lifting-on-the-way-back-only)).

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
- [A row of cards: one popup that walks](#a-row-of-cards-one-popup-that-walks)
- [Lifting on the way back only](#lifting-on-the-way-back-only)
- [What it costs, and where the time goes](#what-it-costs-and-where-the-time-goes)
- [The wall, and the frame before the movement](#the-wall-and-the-frame-before-the-movement)
- [What the browser does around it](#what-the-browser-does-around-it)

## What is lifted is named

`data-lift` marks the one node that IS the trigger once in front: a node inside
the popup, or the popup itself when the whole dialog is that node. A dialog
holding the lifted card plus a badge above and buttons below lifts the card; a
dialog that is the card wears `data-lift` itself. The lift takes the first
`data-lift` the popup holds.

```jsx
<Picker mode="dialog" animation="lifting" ui={<GameCard game={game} />} …>
  <Badge />
  <GameEditCard game={game} data-lift />
  <Buttons />
</Picker>
```

That names one end. The other is the anchor — the box the opening came out of,
and the box the closing goes back into unless `liftAnchor` names another (see
[a row of cards](#a-row-of-cards-one-popup-that-walks)).

The opening waits for the lifted node: a movement started before it exists would
carry the card into an empty box. The dialog is opened at once and held
unpainted — its wall already fading in, the page's scroll already held — and the
lift starts the moment `data-lift` is in the DOM. Past a second without it, the
dialog is shown where it stands, with no movement, and dev warns.

**Render the lifted node at once.** Waiting is a safety net, not the design: a
sheet whose card only exists once its data has landed pays that latency on
every opening. Render the card immediately from what the trigger already holds
(a read-only copy, a skeleton with the card's box), and let the fields fill in
inside it — and keep it built across closes unless it must be rebuilt on every
opening (see [costs](#what-it-costs-and-where-the-time-goes)).

## The trigger's box is the card's box

The movement starts from the trigger's box — the `Picker`'s root, or a
`Dialog`'s `anchor`. That box must be the card's: a trigger wider than the card
it shows (a bare picker stretched by a column flex, an `expandX` whose `ui` does
not fill it) starts the lift from a box the card does not fill. The painted box
then wears the card's width from the first frame while the card sits in its
corner, and the width never reads as changing.

Check it once, at rest: the picker root's `getBoundingClientRect()` equals the
card's. `variant="bare"` with a `ui` that is the card, in a container that does
not stretch it (`alignX="start"` on a column, or the trigger inline), is the
usual shape.

## Two kinds: a card, or a scene

`lift="box"` (default) is one object at two sizes — each picture keeps its own
size, and the box gains room; `lift="scene"` is one scene through two frames —
both pictures are drawn at the box's width, centred. Choose the kind by what
grows: text and controls keep their scale (`box`), a drawing does not (`scene`).

Two traps, both about the thumbnail:

- **A scene under `lift="box"`** keeps the thumbnail at its own size in the
  corner of a growing, empty box, then swaps. Dev warns when the lifted node is,
  box for box, an `<svg>`, `<img>`, `<picture>`, `<canvas>` or `<video>` under
  `box`.
- **A thumbnail that is not the scene framed.** `scene` assumes the thumbnail is
  either the whole drawing smaller, or a band cut from its middle as wide as it.
  A thumbnail letterboxed inside a box of another aspect ratio (an SVG
  `meet`-fitted into a 2:1 frame), or a crop taken off-centre, cannot land on
  the whole: the drawing seems to slide to one side, then reappear centred. Give
  the trigger's frame the scene's own aspect ratio, and crop from the middle if
  you crop.

## The lifted node paints itself

The moving box wears the lifted node's background for the length of the
movement, so where the box has grown past the picture it carries, it is the card
that has grown. That paint is read off `data-lift` — and, when that node paints
nothing, off the first descendant that has its box and paints. So a transparent
wrapper around the card is fine, and a card whose colour lives on a nested
element of a different size is not: publish the colour on the box that is the
card (a gradient or an image travels as well). A shadow or a halo is in the
picture but cut at the box's edge, except when the two boxes are the same size
(`box`) or the same aspect ratio (`scene`): both pictures then fit the box the
whole way, and the ink travels with it.

Corners are not paint: they are written per box, on purpose — the same card at
two sizes does not want the same round. The moving box leaves with the corners
of the box it leaves and arrives with those of the box it arrives on, each read
as the first round found going down through the nodes that are that box — so a
bare trigger carrying its corners itself, or on the card inside it, reads the
same.

## Same width, or a wider box

On a `Picker`, `dialogSizeFromAnchor` alone makes the trigger's width both the
dialog's floor and its ceiling (a `dialogMaxWidth` of the caller's still wins
over the ceiling): the same card, brought forward — the box travels and may grow
in height, never in width. On a `Dialog`, `sizeFromAnchor` is only the floor,
and `maxWidth="var(--anchor-width)"` adds the ceiling. Left out, the sheet can
take the room it has (`dialogExpandX`), and the width change is animated — the
card keeps its scale inside a box gaining room on the right, then the wider
layout arrives.

Both read well; what does not is a box that is neither: a card whose width the
sheet changes by a few pixels for no reason the eye can name. Decide.

## A row of cards: one popup that walks

A row of small drawings — trophies on a profile, photos, badges — where pressing
one brings it to the front, big, and from there the next one is reached without
going back to the row. The popup is then about the whole row, and the press only
says where it opens: one `Dialog` for the row, lifting, holding a
`SlideContainer` the walk moves through. A picker per drawing is the first thing
one writes, and a dead end — each would have to hold the whole row to be
walkable (the third case of
[a shared popup](./popup_open.md#when-a-shared-popup-is-still-the-right-answer)).

```jsx
const currentKeySignal = useSignal(undefined);

<Button
  id={`cup_tile_${cup.key}`}
  command="--navi-open"
  commandFor={ZOOM_ID}
  value={cup.key}
  variant="bare"
>
  <Trophy medal={cup.medal} />
</Button>

<Dialog
  id={ZOOM_ID}
  animation="lifting"
  lift="scene"
  mount="while-opened"
  onOpen={(e) => {
    currentKeySignal.value = e.detail.value;
  }}
  liftAnchor={`cup_tile_${currentKeySignal.value}`}
  expand
  data-slide-container-follows={SLIDES_ID}
>
  <SlideContainer id={SLIDES_ID} signal={currentKeySignal} expandY>
    {cups.map((cup) => (
      <Slide key={cup.key} area={cup.key}>
        <Box data-lift={cup.key === currentKeySignal.value ? "" : undefined}>
          <Trophy medal={cup.medal} size="min(46vw, 180px)" />
        </Box>
        <Circumstances cup={cup} />
      </Slide>
    ))}
  </SlideContainer>
  <SlideContainer.Left commandFor={SLIDES_ID} />
  <SlideContainer.Right commandFor={SLIDES_ID} />
</Dialog>
```

The drawing it opens on is the command's `value`
([opening it ON something](./popup_open.md#opening-it-on-something)), and
`onOpen` writes it into the container's own signal: the press seeds the walk,
and from then on the chevrons, the arrows and a thumb write the same signal.

**`data-lift` moves with the walk, and has to be right on the first frame.** The
lifted node is the current slide's drawing — a condition on the signal — and the
lift takes the first `data-lift` on the frame the popup opens.
`mount="while-opened"` is what makes that the drawing the open named, the
content being built after `onOpen`: content kept across openings still carries
the mark of the drawing the walk was left on. The closing reads it the same way,
and a mark left on a slide the walk moved off is a picture taken off screen: the
box flies in from outside the surface.

**The button is the drawing and nothing else**: its box is what travels (see
[above](#the-triggers-box-is-the-cards-box)), so a count floating in a corner or
a level written underneath belongs outside the button, positioned against the
tile. **No `anchor` prop** either: the button pressed is the anchor
([the anchor](./popup_open.md#the-anchor), third rule), and an `anchor` prop
wins over the press.

**The arrows reach the walk from anywhere on the surface.** The chevrons pinned
to the edges of a full-screen surface are outside the `SlideContainer` — only
slides go in it — so the keyboard, once it lands on one of them, walks nothing.
`data-slide-container-follows={SLIDES_ID}` on the `Dialog`, the outermost
element and what holds the keyboard when nothing in it does, makes the whole
surface a follower.

**Where it comes back to is named too.** A walk that moved on has something else
in front by the time it closes: left alone, the silver cup flies home into the
gold cup's tile. `liftAnchor` says the other end, read at the close — an id
built from the walk's signal, the tiles carrying the matching ids. When that
signal is the address's (the popup's `signal`, see
[popup_open.md](./popup_open.md#signal--the-app-holds-it-both-ways)), a close
through the address, the back button, empties it before the popup knows it is
closing, and a name built from it at that render names no tile: build it from
the last key the walk held — a ref written while the signal holds one.

**A press on the surface that dismisses is `data-navi-popup-outside`** (see
[popup_backdrop.md](./popup_backdrop.md#where-the-outside-begins)), read on the
press itself. A close written by hand on a click has to tell a click from the
end of a swipe — and that guard is the sign the marker was missed.

## Lifting on the way back only

Sometimes the opening is not a lift and the closing is. A banner opens a
full-screen reveal, the crest big in a halo; collecting it sends the crest down
into its place on the rank plate that replaces the banner — a box that did not
exist when the reveal opened.

```jsx
<Dialog
  animation={{ open: "scaling", close: "lifting" }}
  liftAnchor="profile_level_crest"
  onClose={(e) => {
    if (e.detail.requester?.id === "level_collect") {
      levelRevealedSignal.value = true; // renders the plate, and its crest
    }
  }}
>
  <span data-lift>
    <RankCrest size="220px" />
  </span>
  <Button id="level_collect" command="--navi-close" variant="bare">
    Collect
  </Button>
</Dialog>
```

**The opening is whatever `open` says** (`"auto"` included): no wait for
`data-lift`, no opaque wall, and `data-lift` is read at the close alone. Nor
does the opening's own exit play: while a closing lift runs, the dialog's
transitions are off, or `scaling`'s exit would keep the dialog painted into the
picture of the state it closes into.

**The box it lands in is rendered by the close.** `liftAnchor` is read once the
close has been made, `onClose` included, inside the transition: a state written
in `onClose` has rendered by the time the landing is looked up. It is also the
one place that state can be written — before the close, the reveal would
disappear from the picture being left; after it, the picture of the arrival is
already taken — and not by unmounting the dialog with the component that holds
it, which takes it off screen without a close, and without a lift. The dialog
may go away with the state it writes: the picture of the reveal was taken
before. The id goes on the element that is exactly the small crest, not on the
plate around it, for the reason
[the trigger's box is the card's box](#the-triggers-box-is-the-cards-box).

**It is waited for, briefly.** When `liftAnchor` names nothing yet, navi waits
up to 300 ms for it to appear, the screen frozen on the reveal meanwhile — a
render, not a fetch: the landing must be drawable from what the page already
holds. Past the wait, the dialog closes without landing (its picture fades out)
and dev warns.

**Tell the collecting close from the others.** Escape, the back button and a
press on the wall close the dialog too, and usually mean "not now" rather than
"collect". A `Dialog`'s `onClose` receives who asked (`e.detail.requester`, the
button of a `--navi-close`), and only the close that collects writes the state.
The others land nowhere: the fixed `liftAnchor` names nothing, so they wait out
those 300 ms, fade out, and dev warns.

## What it costs, and where the time goes

Navi's own share of an opening — showing the dialog, placing it, the two
pictures — is the smaller part. The rest is the content: preact and the
components of the sheet, spread thin with no single hot spot, plus `showModal()`
and one layout. So the lever is the content:

- **Build less, or earlier.** A sheet that is the same across openings keeps
  `mount="from-first-open"`. A sheet that must be rebuilt (`while-opened`) pays
  its build on every tap; keep it as light as the page allows. A popup whose
  lifted node changes from one opening to the next has no choice, and
  [a row of cards](#a-row-of-cards-one-popup-that-walks) rebuilds every slide
  on every opening.
- **Do not rebuild by accident.** A sheet whose code or data is tied to the
  address (`?edit=<id>` driving a route action) is thrown away when the address
  clears and rebuilt through a `null` render on the next opening —
  `from-first-open` then rebuilds anyway. Keep the code loaded across closes,
  and seed the sheet from what the trigger holds.
- **Warm what a first opening creates.** Intl formatters (a day spin's labels)
  are created on the first opening and cached; a page that will lift a card can
  render one such label at idle.

The movement itself is the browser's: once it starts, the content's cost is
over.

## The wall, and the frame before the movement

The frame the dialog opens on is the picture the movement starts from. On it the
card is still an element of the page, under the wall, and the movement then
draws it on its own, sharp, above the wall — so any wall on that frame is worn
by the card for the length of the build, then taken off at once when the
movement starts: a flash. The wall arrives from nothing, over the movement.

What that frame does not do is say a tap was taken. That answer belongs to the
trigger, which is what the movement starts from anyway: a hold has the finger
still on it, and a `Picker`'s trigger wears `aria-expanded="true"` from the open
on, for an app that wants it pressed in while the sheet builds. The wall's own
paint is
[popup_backdrop.md](./popup_backdrop.md#the-one-animation-that-decides-its-own-backdrop)'s.

## What the browser does around it

- **The page is photographed too**, deliberately: the dialog and its wall live
  in the top layer, which the browser paints during a transition only as part of
  the root's picture (see
  [view_transitions.md](./view_transitions.md#the-top-layer-is-painted-through-the-roots-picture)).
  The price is a page frozen and unpressable while the movement plays: under a
  modal wall at the opening, and for the popup's animation duration at the
  closing.
- **Fixed bars stay in the page's picture**, under the wall like everything
  else. The popup is placed in the room between them, and the moving box is
  clipped to that room on the way, so a card half under the bottom bar leaves
  from under it and comes back under it. Naming the bars to draw them over the
  box was tried: a bar photographed on its own has no wall over it.
- **The page is held still for the movement.** Its picture is frozen for the
  length of the transition while the browser keeps following the live anchor,
  so a scroll would carry the arriving box along under a page that does not
  move. Scroll gestures on the background are cancelled until the movement is
  over, the way `scrollCapture` cancels them while a dialog is open.
- **The closing is photographed whole**, the picture of the popup taken before
  the close takes it off screen: Escape, the wall, `--navi-close` and `navBack`
  all go through it.
- **One lift at a time.** A document has one view transition; a lift started
  while another plays replaces it, and the replaced one is released cleanly.
