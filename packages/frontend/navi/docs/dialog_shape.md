# The shape of a dialog

Where a `Dialog` sits and how big it gets. What happens _inside_ it (scrolling,
`header`/`body`/`footer`) is [`scroll.md`](./scroll.md); what opens it is
[`popup_open.md`](./popup_open.md).

- [A dialog is sized by its content, never by a `width`](#a-dialog-is-sized-by-its-content-never-by-a-width)
- [The ceiling nobody sets](#the-ceiling-nobody-sets)
- [One dialog, two shapes](#one-dialog-two-shapes)
- [Saying the two shapes at once](#saying-the-two-shapes-at-once)
- [`expand` is not "docked", and `expandX={false}` is not "do not sprawl"](#expand-is-not-docked-and-expandxfalse-is-not-do-not-sprawl)
- [`marginWithContainer` decides the gap AND the ceiling](#marginwithcontainer-decides-the-gap-and-the-ceiling)
- [Holding a size while the dialog is open](#holding-a-size-while-the-dialog-is-open)
- [A `layer="local"` dialog answers to its container](#a-layerlocal-dialog-answers-to-its-container)
- [Reaching all of this through a `Picker` or a `SplitButton`](#reaching-all-of-this-through-a-picker-or-a-splitbutton)

## A dialog is sized by its content, never by a `width`

There is no `width` prop, and that is the whole design: a dialog is a surface
laid over the app, and what it holds is what knows how wide it should be. What
a caller states are **bounds** — a floor under a dialog too narrow for its
content, a ceiling over one that would sprawl:

| what you want to say                    | how                       |
| --------------------------------------- | ------------------------- |
| "not narrower than this"                | `minWidth` / `minHeight`  |
| "not wider than this"                   | `maxWidth` / `maxHeight`  |
| "as wide as the container allows"       | `expandX` / `expandY`     |
| "as wide as the control that opened it" | `sizeFromAnchor` (opt-in) |

`sizeFromAnchor` is off by default and that is deliberate: unlike a `Popover`,
a dialog is not attached to what opened it, so following that element's box is
a choice, not the norm. It only ever sets a **floor**
(`--anchor-width`/`--anchor-height`), never a width.

## The ceiling nobody sets

Above every bound a caller passes there is one navi always applies: the
container, minus `marginWithContainer` on both sides
(`--dialog-maxmax-width` / `--dialog-maxmax-height`). It is not a default that
a larger `maxWidth` overrides — it wins, always. A `minWidth` too large for the
screen is clamped by it too, so **no combination of props can produce a dialog
that overflows its container.** Stop trying to defend against that case.

Two consequences worth knowing before writing CSS of your own:

- the caps are applied to the dialog's **size**, not merely to its position.
  That is what makes a centered dialog follow the mobile virtual keyboard for
  free: the ceiling is expressed against the app's live screen
  (`--navi-app-width`/`--navi-app-height`, which track the visual viewport), so
  the browser reflows the dialog as the keyboard opens. Nothing to wire.
- "the container" is the **app's own screen** for `layer="top"` — the visual
  viewport, or the narrower one the app declared with `--navi-app-max-width`
  (see [`safe_area.md`](./safe_area.md)) — and the positioned ancestor for
  `layer="local"`.

## One dialog, two shapes

`dockedOnSmallTouchScreen` is the whole small-screen story in one prop: on a
small touch screen the dialog stops being a centered box and becomes a bottom
sheet; everywhere else nothing changes.

Both halves of the name matter. Touch alone would dock a tablet or a kiosk
panel — a whole screen away from where the finger just tapped. Size alone would
dock a narrow desktop window, which is still a mouse. `smallTouchScreenSignal`
answers both, by shape rather than by a box of maximum dimensions (a phone is a
narrow slab, in either orientation), and it is **live**: turning the phone
re-resolves the dialog.

What docking supplies — defaults only, so any single axis of the sheet can be
adjusted without giving up the rest:

| supplied              | value      | why                                                   |
| --------------------- | ---------- | ----------------------------------------------------- |
| `positionArea`        | `"bottom"` | where the thumbs rest and where the keyboard comes up |
| `marginWithContainer` | `0`        | a sheet is flush, or it is not a sheet                |
| `expandX`             | `true`     | container-wide, same reason                           |
| `scrollCapture`       | `true`     | a drag past the sheet's edge must not reach the page  |

Plus a swipe-down-to-close, held by the sheet's `header` (a `Box` with the
`header` prop) and by anything carrying `data-swipe-grip` — never by the whole
sheet, so a board something is dragged across keeps its own gestures. See
[`drag_to_travel.md`](./drag_to_travel.md).

**`expandY` (or `expand`) cancels docking outright.** A dialog already filling
the height is on the bottom edge docking would bring it to; all docking could
still do is take away the shape the caller asked for, and arm a swipe-down on
something that never rose.

## Saying the two shapes at once

The sentence an app almost always wants is two sentences:

> Keep this dialog between 12 and 16rem so it does not sprawl on a wide window
> and does not collapse to its shortest line. **And when it is a bottom sheet,
> forget all that: a sheet is flush and full width.**

Both halves are written together, and each applies where it means something:

```jsx
<Dialog dockedOnSmallTouchScreen minWidth="12rem" maxWidth="16rem">
```

| prop        | centered box | docked sheet                                          |
| ----------- | ------------ | ----------------------------------------------------- |
| `maxWidth`  | applies      | **withdrawn** — the sheet is container-wide           |
| `minWidth`  | applies      | stops mattering (the floor is below full width)       |
| `maxHeight` | applies      | applies — a sheet is content-tall, not container-tall |
| `minHeight` | applies      | applies                                               |

`maxWidth` is an answer about the _centered_ shape: "do not sprawl on a wide
window". A sheet spanning its container's full width, flush against the two
side edges, **is** the docked mode — so docking withdraws that ceiling rather
than capping the sheet with it. The container ceiling still holds, as always.

> **Trap: do not re-derive the docking condition in the app.** This looks like
> the way to say it and is subtly wrong:
>
> ```jsx
> // WRONG
> maxWidth={smallTouchScreenSignal.value ? undefined : "16rem"}
> ```
>
> Docking is not `smallTouchScreenSignal` — it is
> `dockedOnSmallTouchScreen && smallTouchScreenSignal.value && !expandY`. A
> dialog that also sets `expandY` never docks, so the cap must never be
> withdrawn there, and the line above withdraws it anyway. Beyond being wrong,
> it duplicates a condition navi owns at every call site (it drifts the day
> "docked" gains a rule), and it reads as a bug: it says nothing about bottom
> sheets to the next person. State both bounds plainly and let the dialog
> resolve its own shape.

## `expand` is not "docked", and `expandX={false}` is not "do not sprawl"

`expandX`/`expandY` mean "grow to the ceiling" — the container ceiling above,
capped in turn by `maxWidth`/`maxHeight` when they apply. `expand` is the
shorthand for both.

Since docking _supplies_ `expandX`, passing it explicitly takes the caller out
of that default:

```jsx
// The sheet stops being flush: a floating box at the bottom of the screen.
<Dialog dockedOnSmallTouchScreen expandX={false} />
```

That is consistent — an explicitly passed prop wins over a docked default — and
it is still the trap, because the two props read as answering different
questions (one about the centered shape, one about the phone) when they answer
the same one. If what you meant was "cap the centered box", that is `maxWidth`,
and docking withdraws it on its own.

## `marginWithContainer` decides the gap AND the ceiling

One prop, because they are one fact: the gap a dialog keeps with the edges of
its container is also what its size ceiling is computed from. Writing them
separately is how a dialog ends up flush on one side and inset on the other.

It defaults to a share of whatever holds the dialog (`3appw` for `layer="top"`,
`3cqw` for `layer="local"`) and accepts a spacing token (`"s"`, `"m"`…), a
number of pixels, or a viewport length — `appw`/`apph` being the app's own
screen, `vvw`/`vvh` the visual viewport, which shrinks when the keyboard opens.
Pass `0` for something meant to sit flush (a side panel), and note that docking
already passes `0` for you.

## Holding a size while the dialog is open

`sizing="frozen"` measures the dialog once and holds it until it closes; what
no longer fits — or no longer fills it — becomes the scroll's business. It is
for a surface acted upon while it is open: marking a notification read,
emptying a queue, swapping between two slides of different heights. The row
being aimed at must not move under the finger.

Two things make it safe to reach for:

- the freeze writes a `width`/`height`, never a `min-*` — the caps above keep
  winning, so a frozen dialog still fits when the phone is turned;
- the measure is taken at the first render where the prop says `"frozen"`, so a
  dialog opening on skeletons says `sizing={loading ? "auto" : "frozen"}` and
  is measured once the real content has arrived. Closing releases it.

## A `layer="local"` dialog answers to its container

`layer="top"` (the default) is a real `<dialog>` in the browser's top layer:
native focus trap, `Escape`, hardware back-button dismissal, the rest of the
document made inert. `layer="local"` stays in normal document flow, confined to
and clipped by its own positioned ancestor.

For the shape, that swaps what every bound is measured against: the container
becomes that ancestor's box, read through
`--container-position-remaining-width`/`-height`, and the default margin is
read in container units. Its own container's scroll is always locked while it
is open — its backdrop covers the scrollport, not the scrolled content, so
scrolling would slide the dialog away and reveal what the backdrop does not
cover. `scrollCapture` is what extends that lock to the whole page.

One accepted limitation, not an oversight: a local dialog **cannot** be
dismissed by the hardware/gesture back button. No web API hooks into that
outside the browser's own modal-dismissal stack, which only a genuine
`showModal()` element joins.

## Reaching all of this through a `Picker` or a `SplitButton`

A picker's popup is a popover or a dialog depending on the screen, so it
exposes both sets of bounds under prefixed names, and they mean exactly what
they mean on `Dialog` itself:

`dialogMinWidth`, `dialogMinHeight`, `dialogMaxWidth`, `dialogMaxHeight`,
`dialogExpand`, `dialogExpandX`, `dialogExpandY`, `dockedOnSmallTouchScreen`,
`marginWithContainer` — plus `popoverMaxHeight` and `popupWidthFitContent` for
the other shape.

`SplitButton` forwards the same set to the picker it wraps. Anything not in
that set lands on the split button's own box instead — so a prop that seems to
do nothing to the menu is worth checking against that list first (see
`POPUP_PROP_SET` in `src/control/input/split_button.jsx`).

---

Reference: `src/layout/dialog.jsx` (the stylesheet at the top of the file holds
the cap arithmetic), `src/layout/responsive.js` (`smallTouchScreenSignal`),
`src/control/picker/picker_custom.jsx` (how `--picker-dialog-*` bridges to
`--dialog-*`), and `src/layout/demos/1_dialog_demo.html`.
