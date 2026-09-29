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

`Dialog` has no `width` prop of its own, and that is the whole design: a dialog
is a surface laid over the app, and what it holds is what knows how wide it
should be. What a caller states are **bounds** — a floor under a dialog too
narrow for its content, a ceiling over one that would sprawl:

| what you want to say                    | how                       |
| --------------------------------------- | ------------------------- |
| "not narrower than this"                | `minWidth` / `minHeight`  |
| "not wider than this"                   | `maxWidth` / `maxHeight`  |
| "as wide as the container allows"       | `expandX` / `expandY`     |
| "as wide as the control that opened it" | `sizeFromAnchor` (opt-in) |

`sizeFromAnchor` is off by default and that is deliberate: unlike a `Popover`, a
dialog is not attached to what opened it, so following that element's box is a
choice, not the norm. It only ever sets a **floor**
(`--anchor-width`/`--anchor-height`), never a width.

## The ceiling nobody sets

Above every bound a caller passes there is one navi always applies: the
container, minus `marginWithContainer` on both sides. It is not a default that a
larger `maxWidth` overrides — it wins, always, and a `minWidth` too large for
the screen is clamped by it too, so **no combination of props can produce a
dialog that overflows its container.** Stop trying to defend against that case.

The caps are applied to the dialog's **size**, not merely to its position, and
expressed against the app's live screen (`--navi-app-width`/`--navi-app-height`,
which track the visual viewport): the browser reflows a centered dialog as the
mobile keyboard opens, with nothing to wire. "The container" is the **app's own
screen** for `layer="top"` — the visual viewport minus the app's bands (see
[`safe_area.md`](./safe_area.md)) — and the positioned ancestor for
`layer="local"`.

## One dialog, two shapes

`dockedOnSmallTouchScreen` is the whole small-screen story in one prop: on a
small touch screen the dialog stops being a centered box and becomes a sheet
flush against one edge of the screen; everywhere else nothing changes.

The value says which edge. `true` rests the sheet on the **top** edge, out of
the virtual keyboard's way: a field tapped in the sheet raises the keyboard
below it, and the question and the field stay where the finger found them.
`"bottom"` rests it on the bottom edge, where the thumbs are — for a sheet one
reads and taps (a list, a couple of buttons, a confirmation) and that holds
nothing raising a keyboard. A bottom sheet one types into is reflowed into the
strip left above the keyboard at every keystroke, and the mistake is silent on
the desktop the author tests on — which is why the safe edge is the default, and
why a `"bottom"` sheet found holding a field is warned about in dev, on any
screen.

```jsx
<Dialog dockedOnSmallTouchScreen />          // top: the keyboard cannot reach it
<Dialog dockedOnSmallTouchScreen="bottom" /> // no field in here, thumbs first
```

The edge is the prop's own value rather than `positionArea` because
`positionArea` places _both_ shapes: `positionArea="bottom"` also pins the
centered box to the bottom of a desktop window.

Both halves of the name matter: touch alone would dock a tablet or a kiosk panel,
size alone a narrow desktop window, which is still a mouse.
`smallTouchScreenSignal` answers both, by shape rather than by a box of maximum
dimensions (a phone is a narrow slab, in either orientation). A `Dialog` follows
it live: turning the phone re-resolves it. A `Picker` decides popover or dialog
again at each opening, but a `Popup` decides once, for its lifetime — one
mounted as a popover never docks.

What docking supplies are defaults — `positionArea` (the edge),
`marginWithContainer={0}` (a sheet is flush, or it is not a sheet), `expandX`
and `scrollCapture` — so any single axis of the sheet can be adjusted without
giving up the rest.

A `layer="top"` dialog flush with an edge of the screen — `marginWithContainer`
at `0` with a `positionArea` on that edge or an `expand` across it, as a docked
sheet is — keeps the band the device reserves there (`env(safe-area-inset-*)`:
the notch, the home indicator, Safari's floating bar): the surface reaches the
edge, what it holds stops at the band. A centered dialog with a `0` margin
touches no edge, and gets no band. Only the device's own inset: the dialog is in
front of the app's fixed bars, so `--navi-safe-area-inset-*`, which counts them
too (see [`safe_area.md`](./safe_area.md)), is not what it reads.

A docked sheet closes by a swipe through the edge it rests on, held by its
`header` and by anything carrying `data-swipe-grip` — never by the whole sheet,
so a board something is dragged across keeps its own gestures (see
[`drag_to_travel.md`](./drag_to_travel.md)).

**`expandY` (or `expand`) cancels docking outright.** A dialog already filling
the height touches both edges; all docking could still do is take away the
shape the caller asked for, and arm a swipe on something that never rose.

## Saying the two shapes at once

The sentence an app almost always wants is two sentences:

> Keep this dialog between 12 and 16rem so it does not sprawl on a wide window
> and does not collapse to its shortest line. **And when it is a sheet, forget
> all that: a sheet is flush and full width.**

Both halves are written together, and each applies where it means something:

```jsx
<Dialog dockedOnSmallTouchScreen minWidth="12rem" maxWidth="16rem">
```

`maxWidth` is an answer about the _centered_ shape: "do not sprawl on a wide
window". A sheet spanning its container's full width **is** the docked mode, so
docking withdraws that ceiling rather than capping the sheet with it; the
container ceiling still holds. `minWidth` stops mattering there (the floor is
below full width), and `maxHeight`/`minHeight` keep applying — a sheet is
content-tall, not container-tall.

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
> "docked" gains a rule), and it says nothing about docked sheets to the next
> person. State both bounds plainly and let the dialog resolve its own shape.

## `expand` is not "docked", and `expandX={false}` is not "do not sprawl"

`expandX`/`expandY` mean "grow to the ceiling" — the container ceiling above,
capped in turn by `maxWidth`/`maxHeight` when they apply. `expand` is the
shorthand for both. Since docking _supplies_ `expandX`, passing it explicitly
takes the caller out of that default:

```jsx
// The sheet stops being flush: a floating box against its edge of the screen.
<Dialog dockedOnSmallTouchScreen expandX={false} />
```

That is consistent — an explicitly passed prop wins over a docked default — and
it is still the trap, because the two props read as answering different
questions (one about the centered shape, one about the phone) when they answer
the same one. "Cap the centered box" is `maxWidth`.

## `marginWithContainer` decides the gap AND the ceiling

One prop, because they are one fact: the gap a dialog keeps with the edges of
its container is also what its size ceiling is computed from. Writing them
separately is how a dialog ends up flush on one side and inset on the other.

It defaults to a share of whatever holds the dialog (`3appw` for `layer="top"`,
`3cqw` for `layer="local"`) and accepts a number of pixels, a viewport length —
`appw`/`apph` being the app's own screen, `vvw`/`vvh` the visual viewport, which
shrinks when the keyboard opens — or a container length (`cqw`/`cqh`). A
spacing token (`"s"`, `"m"`…) cannot be resolved to pixels here: navi warns and
places the dialog flush. Pass `0` for something meant to sit flush (a side
panel); docking already passes it.

## Holding a size while the dialog is open

`sizing="frozen"` measures the dialog once and holds it until it closes — for a
surface acted upon while it is open (emptying a queue, swapping between two
slides of different heights), where the row being aimed at must not move under
the finger. The caps above keep winning; a dialog opening on skeletons says
`sizing={loading ? "auto" : "frozen"}`, to be measured once the real content has
arrived.

## A `layer="local"` dialog answers to its container

`layer="top"` (the default) is placed against the screen and clipped by nothing;
`layer="local"` stays in normal document flow, confined to and clipped by its
own positioned ancestor, which every bound is then measured against (the
default margin in container units). Its container's scroll is locked while it
is open — its backdrop covers the scrollport, not the scrolled content — and
`scrollCapture` extends that lock to the whole page.

For a **docked** dialog, `layer` is the choice of what the sheet rests against.
A sheet meant for the bottom of the screen is `layer="top"`, even when the page
behind it must stay live — that is `backdrop={false}`, not `layer="local"`.
Whether a dialog is modal, and what one that is not gives up (the back button),
is [`popup_backdrop.md`](./popup_backdrop.md#is-there-a-backdrop-at-all)'s.

## Reaching all of this through a `Picker` or a `SplitButton`

A picker's popup is a popover or a dialog depending on the screen, so it exposes
the dialog's bounds under prefixed names (`dialogMinWidth`, `dialogMaxWidth`,
`dialogExpandX`…), next to `dockedOnSmallTouchScreen` and `marginWithContainer`.
They mean what they mean on `Dialog`, with one exception: `dialogSizeFromAnchor`
makes the trigger's width the dialog's ceiling as well as its floor (see
[popup_lift.md](./popup_lift.md#same-width-or-a-wider-box)).

`SplitButton` forwards its popup props to the picker it wraps, and its menu is a
popover unless it says `mode="dialog"` — its `dialog*` props do nothing until
then. Anything not in its `POPUP_PROP_SET` (`src/control/input/split_button.jsx`)
lands on the split button's own box instead, so a prop that seems to do nothing
to the menu is worth checking against that list first.

---

Reference: `src/layout/dialog.jsx` (the stylesheet at the top of the file holds
the cap arithmetic), `src/layout/responsive.js` (`smallTouchScreenSignal`), and
`src/layout/demos/1_dialog_demo.html`.
