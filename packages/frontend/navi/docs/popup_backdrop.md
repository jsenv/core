# The backdrop

What a `Dialog`, a `Popover` — and everything built on them: `Popup`,
`SidePanel`, a `Picker`'s popup — lays between itself and the page it opened
over.

It answers three questions, and they are independent:

1. **Is there anything between the popup and the page at all?** That is
   `backdrop`.
2. **What does a press outside do?** Close, cancel, be absorbed, pass through.
   That is `pressOutside`.
3. **How far does what is behind withdraw?** Dimmed, blurred, barely marked,
   not painted at all. That is the paint: `backdropVariant`, `backdropColor`,
   `backdropFilter`.

Keeping them apart is the whole point of this page: how much the page withdraws
says nothing about what the click does, and neither says whether the page behind
is still reachable.

## Is there a backdrop at all

A backdrop is a wall: an element in front of the page — the screen, or the box
a `layer="local"` popup is confined to — which wins hit-testing. That is how it
absorbs a press: not by handling the event and stopping it, but by being what
the pointer hits. Nothing behind it hears anything.

So a popup that closes on an outside press spends that press: the first press
dismisses, and a second one is needed to do what the user was already pointing
at. That is right when the page has withdrawn — the dim says the page is off,
and a press on it means "come back". It is wrong when nothing withdrew: over a
map, a plan, a canvas that looks exactly as pressable as a second ago, the next
press continues the gesture, and taking it to close the bubble spends it on
something the user never asked for.

`backdrop={false}` is how that popup says there is no wall:

```jsx
<Popover pressOutside="close" backdrop={false}>
```

The popup then hears an outside press from the document itself, and takes
nothing from it: no `preventDefault`, no `stopPropagation`. It closes, and the
same press is answered by whatever it landed on — one gesture, one press. It
listens to `pointerdown`, the press itself, since a cancelled `pointerdown` (a
drag source, a control keeping the focus) suppresses every mouse event after
it: the popup dismisses on the press, whatever the element under it does with
it.

**It is not `backdropVariant="invisible"`.** A wall that is not painted is still
a wall, and it still eats the press. `"invisible"` is for a popup that must
absorb — a menu whose dismissing click must not also press what is under it —
without dimming the page for it; `backdrop={false}` is for a popup that must not
absorb at all.

**It is what decides whether a popup is modal.** `Popover` is never modal,
either layer, and neither is a `layer="local"` dialog. A top-layer `Dialog` is
modal exactly when it has a wall of its own: with one it is `showModal()`'d and
the browser makes everything behind genuinely inert; without one it goes to the
same top layer through the Popover API, placed against the screen just the
same, over a page that stays live — or, in a `PopupGroup`, over a page the
group's wall covers (see
[Popups that hand over to each other](#popups-that-hand-over-to-each-other-popupgroup)). `Popup` forwards `backdrop` in both modes, so which of
popover or dialog the small-screen resolution picks says nothing about whether
one press or two are needed.

That is what a sheet on a phone is made of. `dockedOnSmallTouchScreen` docks the
dialog against an edge of its container (see
[`dialog_shape.md`](./dialog_shape.md)), and `layer` is what that container is —
`"top"` for the screen, `"local"` for the box the popup was declared in. A sheet
flush with the bottom of the screen over a map still being read object by
object is `layer="top"` for the shape and `backdrop={false}` for the map:

```jsx
<Popup dockedOnSmallTouchScreen="bottom" layer="top" backdrop={false}>
```

Going `layer="local"` to keep the map live instead confines the sheet to the box
it was declared in — full width and flush against _that_, which on a partial
container reads as a sheet that failed rather than as a sheet.

Outside a `PopupGroup`, what a dialog that is not modal — wall-less, or
`layer="local"` — gives up is the one thing only a modal gets natively: the
hardware/gesture back button no longer dismisses it. No web API hooks into that outside the browser's own
modal-dismissal stack, which only a genuine `showModal()` element joins: an
accepted limitation, not an oversight. A wall-less `Dialog` does not trap the
focus either, deliberately — a page meant to be reachable is meant to be
reachable with the keyboard too. (A `SidePanel` that closes on an outside press
does trap Tab in popover mode: it sets `focusCapture`.) In a group the group is
the modal: the back gesture closes the open popup as a cancel, and the keyboard
stays in the group (see
[Popups that hand over to each other](#popups-that-hand-over-to-each-other-popupgroup)).

`pressOutside="capture"` and `backdrop={false}` contradict each other —
absorbing is what a wall does — and navi warns rather than silently behaving
like `"ignore"`.

## Where the outside begins

A popup reads "outside" from its own border box. What the press landed on
settles nothing by itself — a press on a real backdrop and a press on the
popup's own padding both report the popup element as their target — so the
rectangle is what tells them apart. That works as long as the box and what the
popup paints are the same thing. A popup with no surface of its own is the case
where they are not:

```jsx
<Dialog
  backgroundColor="transparent"
  boxShadow="none"
  border="none"
  padding="0"
/>
```

Here the sheet is whatever the children paint, and everything between them is
backdrop to the eye and inside the box to the code. A press just above the box
dismisses the popup; the same press two pixels lower, on the empty half of a
row, is ignored.

`data-navi-popup-outside` is how the caller says which of its own boxes are not
the surface:

```jsx
<Box data-navi-popup-outside flex justifyContent="center">
  <HourWheel />
</Box>
```

A press on that row — left of the wheel, right of it, or anywhere in the height
it reserves while the wheel is hidden — does exactly what the same press on the
backdrop does, `pressOutside` and all. It is opt-in because navi cannot infer
it: only the caller who chose the transparency knows which box is decoration and
which is paper.

**The marker answers for the element it is on, never for its descendants.** The
wheel above is painted, so a press on it is a press on the popup — which is what
lets one marker cover a whole row without swallowing the controls it holds. A
nested box that is see-through too needs its own marker.

**Inside a box that travels by drag, the marker answers the click.** A press on
a row of slides, or on a sheet that swipes closed, may be the start of that
travel; the popup closes on the click that ends the press, which a travel
swallows, rather than at the press itself.

**Space beside something, not space between two things.** What the wheel does
not cover is plainly nothing, and a press there reads as a press on the page.
The gap between two rows of a column does not read that way — it is a seam of
one thing the eye holds together, and on a phone it is where a thumb lands on
its way to the control below. So the marker goes on a box that IS free space —
the height a slot reserves while its control is hidden, the margin beside a
centred control — and never on the column that stacks the sheet's parts: a
layout box is mostly its gaps, and marking one turns every gap into a dismissal.
Navi does not warn about a marked container: from the outside the two are the
same box, and only the caller knows which one it wrote.

A box that only reserves space while something is away gives the marker back
when that something returns:

```jsx
<Box data-navi-popup-outside={sunControls ? undefined : ""} height="3em">
  {sunControls}
</Box>
```

### A box of the page that is not outside

`data-navi-popup-inside` is the other direction: a box of the page the caller
says belongs to a popup, so that a press on it is not outside that popup even
though it lies beyond the border box. A board with one panel for all its cards
is the case: pressing another card is what changes what the panel shows, and a
panel that closes on that press then reopens on the click that follows is a
panel meant to stay open, blinking.

```jsx
<SidePanel
  id="error_panel"
  signal={openCardIdSignal}
  backdrop={false}
  closeByPressOutside
>
  …
</SidePanel>

<Box data-navi-popup-inside="error_panel" interactions={{ click: openCard }}>
  …
</Box>
```

The value names the popup by `id`, the way `commandfor` does — several ids with
a space between them — and the exemption is that popup's alone: a menu open
beside the board still closes when a card is pressed. Unlike the outside marker,
this one answers for its whole subtree: it adds a whole thing to the popup's
ground — the card, its count, its buttons — and nothing in it is a dismissal. It
reads a press the page hears, so it belongs with a popup that has no wall
(`backdrop={false}`), or with a popup of a `PopupGroup` and a box of that group:
behind a wall, no card is pressable.

### `pointer-events: none` and `inert` are not this

Neither says "this is backdrop", and reaching for them here is the natural
mistake. Both take the box out of hit-testing — `inert` as well as speaking to
the keyboard and to assistive technology — so the press is answered by the
nearest ancestor still in it: still a descendant of the popup, still inside. On
the marked box, either makes the marker unreachable (navi warns about
`pointer-events: none` in dev). On a decoration _inside_ a marked box,
`pointer-events: none` is the one useful case: the press falls to the marked
box, which is the answer wanted.

## Popups that hand over to each other: `PopupGroup`

A wall spends the first press, and between popups that follow one another that
is the wrong press to spend. On a row of score cells, each a picker, going from
one cell to the next costs a press to dismiss and a second one to open, though
the user pointed at the next cell straight away. `backdrop={false}` gives the
press back, but leaves the whole page live; `"invisible"` hides the dim and
gives nothing back.

`PopupGroup` keeps the wall and moves it: around a box of the page, with that
box in front.

```jsx
<PopupGroup backdropColor="rgb(6 10 20 / 60%)">
  <Picker mode="popover">…</Picker>
  <Picker mode="popover">…</Picker>
  <Button action={addSet}>+</Button>
</PopupGroup>
```

While one of its popups is open, what the group holds stays lit and answers for
real — hover, the pressed state, a gesture, the focus — and the rest of the
screen is behind the wall, which can now be dimmed: the screen says what
answers. A row of score cells, a menu bar, a toolbar, the players of a court
each opening a bubble.

### Inside is the DOM

A popup is a member by being rendered inside the group: no name, no id.
`Popover`, `Dialog` and what is built on them count — `Popup`, `SidePanel`,
`SplitButton`, a `Picker`'s popover, dialog or callout. Every other control the
group holds is pressable too: a "+" or a delete button needs nothing.

**What is not a descendant of the group is behind the wall, wherever it is
painted.** While a popup of the group is open, the group is the modal, and the
browser makes everything else inert: a neighbour lifted above the wall with a
`z-index`, or rendered elsewhere through a portal, is painted and dead.

A popup opened from inside a member is in front of it, not a peer of it: the
group stops at each popup. What is lit is the group's whole box, its background
and border with it, so the group is the smallest box that holds the peers — on a
court that also draws its links and its empty seats, a layer that holds only
the players.

### What a press does while one is open

- On another popup's trigger: the open popup closes — a `Picker` notes its
  value — and that one opens, in the same press.
- On anything else in the group: the open popup closes, and the press does what
  it does there.
- On the wall: the open popup closes, and nothing else hears the press.
- Inside the open popup, or on a box marked `data-navi-popup-inside` for it:
  nothing closes.

One popup of the group is open at a time: a press on another trigger, or a
popup opened from the keyboard or from code, asks the open one to close first.
A popup that refuses to close (a value it cannot note) stays open: it keeps the
press, and nothing else opens; one opened from the keyboard or from code opens
beside it.

**`pressOutside` stays the popup's, read against a wall that is always there.**
`"close"` and `"cancel"` work as everywhere, `"capture"` spends the press and
stays open, and `"ignore"` closes like `"close"`: there is no page under it to
reach. `backdrop={false}` on a member changes nothing.

### The group is the modal, its popups are not

A `Dialog` in a group is never `showModal()`'d: it goes to the top layer
through the Popover API, above the group. It keeps what a modal gives all the
same, since the group is one: everything outside is inert, the keyboard reaches
only what the group holds, and Escape and the back gesture close the open popup
as a cancel, wherever the focus is in the group. A group works inside a sheet,
and closes with it.

**The wall is the group's.** `backdropVariant`, `backdropColor` and
`backdropFilter` go on `<PopupGroup>`, whose default paint is the `close` pair,
like a top-layer `Dialog`'s. A member's own are not read, and navi warns in
dev; neither is what its `"capture"` or its `animation="lifting"` would paint —
`backdropVariant="lift"` on the group is that wall. Above the screen, the
browser's colour is the group's wall over the page's colour, and the group's
`themeColor` answers for it; a member flush with the top edge still lays its
surface over that, and a member's own `themeColor`, when it names a colour,
gives the colour while it is open.

**The page behind stays still while a `Popover` or a `Dialog` of the group is
open**, the wheel or the finger on the wall or over a part of the group with
nothing to scroll. A callout of the group lets the page scroll, as a callout
does anywhere, and goes away on that scroll when told to
(`calloutCloseByScroll`) — where the group stands in the page's own scroll. In
a sheet, a list that scrolls on its own or a fixed bar, a gesture on the wall
could only scroll the document behind, never the box the group stands in: the
page stays still there too, and a wheel over the bubble still scrolls that
box.

### While one is open, the group leaves the page

To stand in front, the group is shown in the top layer where it stands. An
invisible placeholder keeps its place in the page — the element just before it,
marked `navi-out-of-flow` (see
[`css_architecture.md`](./css_architecture.md#counting-children-what-navi-puts-in-your-tree))
— and the group stays pinned to that place: it follows a scroll, a resize, a
sheet that moves, and is clipped as its ancestors clip it. At rest it is a
`<dialog>` the app styles as it would a `<div>`.

A `Dialog` rendered among the group's peers is a member, never modal; one
opened from inside a member is in front of it, and modal as anywhere. A drag
that starts outside the open popup — a card carried from the group — closes it
as a press there would, and the group goes back into the page at once, where
the drag can land.

## Painting one popup: two props

```jsx
<Dialog backdropColor="rgb(6 10 20 / 88%)" backdropFilter="blur(4px)">
```

`backdropColor` is the wash, `backdropFilter` what it does to the picture
underneath; either alone is fine — a blur over navi's default dim keeps the page
recognisable without darkening it further. `Popup`, `SidePanel`, `Picker` and
`SplitButton` forward both, next to `backdropVariant`.

## Painting every popup: the theme tokens

When the choice is the app's rather than one popup's, it goes on `:root`. Each
kind of backdrop has a colour **and** a filter, and they travel together:

| kind                                            | tokens                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| the default (`pressOutside` close/cancel)       | `--navi-backdrop-close-background`, `--navi-backdrop-close-backdrop-filter`       |
| `pressOutside="capture"`                        | `--navi-backdrop-capture-background`, `--navi-backdrop-capture-backdrop-filter`   |
| `backdropVariant="discrete"`                    | `--navi-backdrop-discrete-background`, `--navi-backdrop-discrete-backdrop-filter` |
| `animation="lifting"`, `backdropVariant="lift"` | `--navi-backdrop-lift-background`, `--navi-backdrop-lift-backdrop-filter`         |

The `close` pair is also a top-layer `Dialog`'s base paint, so `"ignore"` still
dims there. A `layer="local"` dialog paints nothing under `"ignore"` — its wall
is still there — and a `Popover` renders no backdrop at all. `"ignore"` is
`SidePanel`'s default.

Only `capture` blurs out of the box among the first three: the rest of the page
is genuinely unreachable then, so it reads as clearly secondary. Nothing else
about `capture` makes the blur its own — set the `close` filter token and every
popup that closes on an outside click blurs too.

## The one animation that decides its own backdrop

Every kind above is keyed on what the popup _does_. `animation="lifting"` is
keyed on what the popup _is_: not a surface shown over the page, but the box the
anchor became. That changes the answer to "how far does what is behind
withdraw?", so it brings its own pair — opaque, blurred — rather than the 8%
wash a popup shown over a page still being read wants.

Three things follow from the morph, and all three point the same way. What is
lifted is looked at — brought forward because it could not be read where it was
— and anything still legible behind competes with it. Such a popup often paints
no surface of its own (`backgroundColor="transparent"`), which makes the
backdrop the background of its content. And the movement is the browser
interpolating a picture of the document: a crisp page behind a box still
travelling reads as two things moving at once.

It is a default, not a rule: the paint props win over it as they win over
everything, and `backdropVariant="discrete"` is how a lifting popup asks for the
light wash back. `backdropVariant="lift"` is the same thing said the other way
round: that wall, on a popup that does not morph but whose content is what the
eye is on — a picture opened full, a plan, a card painting its own surface.

`"invisible"` is the one kind with no filter token: it paints nothing, and a
filter would still be seen.

## Above the screen: the browser's colour

On a phone the browser paints a band above the page — Chrome's address bar, the
status bar of an installed app — in the colour of `<meta name="theme-color">`.
It touches the page's top edge, so it reads as part of whatever is drawn there.
A backdrop that stops at the top of the viewport, under a band still at full
brightness, reads as two layers that do not belong together. So navi works that
colour out from what is on screen:

- **The page says it with `<Head>`**, the way it says its title:

  ```jsx
  <Head>
    <meta name="theme-color" content="#2563a8" />
  </Head>
  ```

  The last `<Head>` to arrive wins, whatever order they leave in (a route
  transition puts the arriving page up before it takes the leaving one down). A
  `theme-color` meta written in the HTML shows when no `<Head>` gives one.

- **Each open popup in the top layer paints over it**, in the order they
  opened: its backdrop colour over the colour under it, then its own background
  over that when it is flush with the top edge — `marginWithContainer={0}` with
  `expand`/`expandY` or a top `positionArea`, which is what a full-screen
  dialog or a `SidePanel side="top"` is. A wash of `rgba(12, 23, 44, 0.45)` over
  a `#2563a8` bar gives `#1a4170`. A navy full-screen dialog gives its navy.

The colour changes when the opening starts, and changes back when the closing
starts. If the page under an open popup changes its colour, the popup paints
over the new one. Each `media` a page gives (one colour per
`prefers-color-scheme`) is painted over on its own.

Nothing is written at the call site. The `themeColor` prop is for what navi
cannot read:

- the `backdropFilter` is left out: a flat colour has nothing to blur;
- a surface painted with an image or a gradient has no colour to read, and
  `themeColor="#0c172c"` gives it one;
- `themeColor={false}` leaves the colour under the popup as it is.

**An app that wants one colour up there, whatever is open,** says so once:

```css
:root {
  --navi-popup-theme-color: none;
}
```

A `theme-color` meta in the HTML cannot do this on its own: it is the bottom of
the stack, and every popup paints over it. The token takes the prop's values:
`auto` (the default) paints, `none` leaves the colour as it is, a colour
forces that one under every popup. The prop wins over it, so
`themeColor="auto"` is how one popup paints again. The token is a custom
property and inherits, so a part of the app can set it on its container. It is
read when a popup starts opening.

A popup that lays nothing over the edge changes nothing: `backdropVariant="invisible"`,
`backdrop={false}`, a `Popover` without a backdrop, any `layer="local"` popup.
A `Popover` paints its backdrop only, never its surface: it has no notion of
being flush with an edge.

**A `<Head>` inside a popup does not give the popup's colour.** It counts as a
page's `<Head>`, under every popup, including the one holding it. It also stays
after the closing. A popup's content stays mounted once built (`mount`, see
[`popup_open.md`](./popup_open.md)), and its `<Head>` stays with it, so its colour
remains after the popup has gone. `themeColor` lasts exactly as long as the
popup is open.

## Why props, and not a rule in the app's stylesheet

**The backdrop is not inside the popup**, and which element it is depends on the
renderer:

| popup                  | its backdrop                                                      |
| ---------------------- | ----------------------------------------------------------------- |
| `Dialog layer="top"`   | the native `::backdrop` pseudo-element of the `<dialog>`          |
| `Dialog layer="local"` | a sibling `div.navi_dialog_backdrop`, before the dialog's wrapper |
| `Popover`              | a sibling `.navi_popover_backdrop`                                |
| a popup of a group     | the native `::backdrop` of the `PopupGroup`'s `<dialog>`          |

The pseudo-element inherits custom properties from the dialog — which is what
makes the tokens above reach it at all. The sibling elements do not: they
inherit from whatever holds the popup. So a custom property set on the popup
itself lands on the paint under one renderer and silently does nothing under the
other, and a stylesheet rule hanging off the popup's own class cannot reach the
sibling at all except through a `:has()` that writes navi's DOM shape into the
app's stylesheet — the kind of selector that stops matching the day navi moves a
box. The props exist for that: navi sets them on the element that paints,
whichever one it is.

## What wins over what

Painting is resolved through two variables, `--backdrop-background` and
`--backdrop-filter`, on the element that paints — the `<dialog>` of a top-layer
one, whose `::backdrop` inherits them, the sibling element otherwise. Navi's own
rules — keyed on `pressOutside`, `animation="lifting"` and `backdropVariant` —
write them as defaults; the props write them inline on the same element, which
beats every rule. So `backdropColor` wins over `backdropVariant="invisible"`,
and a variant is only ever what the caller did not say. A `Popover` with
`pressOutside="ignore"` has no backdrop, so there is nothing for either prop to
paint.
