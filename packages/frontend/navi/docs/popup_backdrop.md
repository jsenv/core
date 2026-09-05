# The backdrop

What a `Dialog`, a `Popover` — and everything built on them: `Popup`,
`SidePanel`, a `Picker`'s popup — lays between itself and the page it opened
over.

It answers two questions, and they are independent:

1. **What does a press outside do?** Close, cancel, be absorbed, pass through.
   That is `pointerInteractionOutsideEffect`.
2. **How far does what is behind withdraw?** Dimmed, blurred, barely marked,
   not painted at all. That is the paint: `backdropVariant`, `backdropColor`,
   `backdropFilter`.

Keeping them apart is the whole point of this page. A popup that must close on
an outside click — because that click is the way out of the screen — may also
need the page behind to stop competing for the eye. How much it withdraws says
nothing about what the click does.

## Where the outside begins

A popup reads "outside" from its own border box. What the press landed on
settles nothing by itself — a press on a real backdrop and a press on the
popup's own padding both report the popup element as their target, there being
no `::backdrop` node to be one — so the rectangle is what tells them apart.

That works as long as the box and what the popup paints are the same thing. A
popup with no surface of its own is the case where they are not:

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
row, is ignored — the rectangle says it landed on the popup.

`data-navi-popup-outside` is how the caller says which of its own boxes are not
the surface:

```jsx
<Box data-navi-popup-outside flex justifyContent="center">
  <HourWheel />
</Box>
```

A press on that row — left of the wheel, right of it, or anywhere in the height
it reserves while the wheel is hidden — does exactly what the same press on the
backdrop does, `pointerInteractionOutsideEffect` and all: `"cancel"`
reverts, `"capture"` absorbs it, `"none"` (a `Popover`'s default, where no
backdrop is rendered at all) leaves it without an answer.

It is opt-in because navi cannot infer it: a background can come from anywhere,
and the caller who chose the transparency is the one who knows which box is
decoration and which is paper.

**The marker answers for the element it is on, never for its descendants.** The
wheel above is painted, so a press on it is a press on the popup — which is
what lets one marker cover a whole row without swallowing the controls it
holds. Mark the box whose own background is the see-through part; a nested box
that is see-through too needs its own marker.

### `pointer-events: none` and `inert` are not this

Neither says "this is backdrop", and reaching for them here is the natural
mistake:

- `pointer-events: none` takes the box out of hit-testing, so the press is
  answered by the nearest ancestor that is still in it — still a descendant of
  the popup, still inside. Putting it on the marked box makes the marker
  unreachable; navi warns about that in dev. Putting it on a decoration
  _inside_ a marked box is the one useful case: the press falls to the marked
  box, which is the answer wanted.
- `inert` speaks to the keyboard and to assistive technology. It does nothing
  at all for a press.

## Painting one popup: two props

```jsx
<Dialog
  backdropColor="rgb(6 10 20 / 88%)"
  backdropFilter="blur(4px)"
>
```

`backdropColor` is the wash (any CSS color), `backdropFilter` what that wash
does to the picture underneath (any `backdrop-filter` value — `blur()`,
`saturate()`, `grayscale()`). Either alone is fine: a blur over navi's default
dim keeps the page recognisable without darkening it further.

Both are forwarded by `Popup`, `SidePanel`, `Picker` and `SplitButton`, next to
`backdropVariant`.

## Painting every popup: the theme tokens

When the choice is the app's rather than one popup's, it goes on `:root`. Each
kind of backdrop has a colour **and** a filter, and they travel together:

| kind                                                         | tokens                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| the default (`pointerInteractionOutsideEffect` close/cancel) | `--navi-backdrop-close-background`, `--navi-backdrop-close-backdrop-filter`       |
| `pointerInteractionOutsideEffect="capture"`                  | `--navi-backdrop-capture-background`, `--navi-backdrop-capture-backdrop-filter`   |
| `backdropVariant="discrete"`                                 | `--navi-backdrop-discrete-background`, `--navi-backdrop-discrete-backdrop-filter` |

Only `capture` blurs out of the box: the rest of the page is genuinely
unreachable then, so it reads as clearly secondary. Nothing else about `capture`
makes the blur its own — set the `close` filter token and every popup that
closes on an outside click blurs too.

`backdropVariant` is the shorthand for the other direction: `"discrete"` for a
barely-there dim, `"invisible"` for no paint at all. It never changes what the
outside click does — the backdrop is still there and still catches it.

`"invisible"` is the one kind with no filter token: it paints nothing, and a
filter would still be seen.

## Why props, and not a rule in the app's stylesheet

**The backdrop is not inside the popup**, and which element it is depends on the
renderer:

| popup                  | its backdrop                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `Dialog layer="top"`   | the native `::backdrop` pseudo-element of the `<dialog>`                                             |
| `Dialog layer="local"` | a sibling `div.navi_dialog_backdrop`, before the dialog                                              |
| `Popover`              | a sibling `.navi_popover_backdrop` (see popover.jsx's top comment for why it cannot be a descendant) |

The pseudo-element inherits custom properties from the dialog — which is what
makes the tokens above reach it at all. The sibling elements do not: they
inherit from whatever holds the popup. So a custom property set on the popup
itself lands on the paint under one renderer and silently does nothing under the
other, and a stylesheet rule hanging off the popup's own class cannot reach the
sibling at all except through a `:has()` that writes navi's DOM shape into the
app's stylesheet — the kind of selector that stops matching the day navi moves a
box.

The props exist for that: navi sets them on the element that paints, whichever
one it is, so the same two lines hold under both renderers.

## What wins over what

Painting is resolved through two variables the popup and its backdrop carry,
`--backdrop-background` and `--backdrop-filter`. Navi's own rules — the ones
keyed on `pointerInteractionOutsideEffect` and on `backdropVariant` — write them
as defaults; the props write them inline on the same element, which beats every
rule. So `backdropColor` wins over `backdropVariant="invisible"`, and a variant
is only ever what the caller did not say.

A `Popover` with `pointerInteractionOutsideEffect="none"` renders no backdrop at
all: there is nothing to paint, and both props are ignored.
