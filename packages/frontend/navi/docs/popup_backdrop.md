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
modal exactly when it has a wall: with one it is `showModal()`'d and the browser
makes everything behind genuinely inert; without one it goes to the same top
layer through the Popover API, placed against the screen just the same, over a
page that stays live. `Popup` forwards `backdrop` in both modes, so which of
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

What a dialog that is not modal — wall-less, or `layer="local"` — gives up is
the one thing only a modal gets natively: the hardware/gesture back button no
longer dismisses it. No web API hooks into that outside the browser's own
modal-dismissal stack, which only a genuine `showModal()` element joins: an
accepted limitation, not an oversight. A wall-less `Dialog` does not trap the
focus either, deliberately — a page meant to be reachable is meant to be
reachable with the keyboard too. (A `SidePanel` that closes on an outside press
does trap Tab in popover mode: it sets `focusCapture`.)

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
(`backdrop={false}`): behind a wall, no card is pressable.

### `pointer-events: none` and `inert` are not this

Neither says "this is backdrop", and reaching for them here is the natural
mistake. Both take the box out of hit-testing — `inert` as well as speaking to
the keyboard and to assistive technology — so the press is answered by the
nearest ancestor still in it: still a descendant of the popup, still inside. On
the marked box, either makes the marker unreachable (navi warns about
`pointer-events: none` in dev). On a decoration _inside_ a marked box,
`pointer-events: none` is the one useful case: the press falls to the marked
box, which is the answer wanted.

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
