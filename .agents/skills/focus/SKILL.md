---
name: focus
description: How @jsenv/navi decides who holds the keyboard and whether a focus ring shows — the two questions every programmatic focus has to answer, the one ladder that answers the first, and the modality rule that answers the second. Use when writing or changing anything in navi that moves the focus (a container opening, an arrival, a control handing over, a swap).
---

# What we want, before how

Two feelings, and every rule below serves one of them.

1. **The focus is where I am.** Whatever just arrived — a popup, a screen, a
   control taking the place of another — the keyboard is on the thing I came
   for. Not on the first focusable that happens to be there, not nowhere.
2. **A ring appears when I am on the keyboard, and only then.** Someone
   pressing with a finger or a mouse must not be shown an outline they did not
   ask for; someone on Tab must never lose track of where they are.

The second one is why a bare `element.focus()` is a bug in navi even when it
lands on the right element: it answers "who" and stays silent on "is this
visible", and the browser then decides — from the last thing that happened to
touch the DOM rather than from what the user did.

An app must never have to think about either. Every navi component answers the
same way, out of one place, which is what makes the answer trustworthy.

## The rules

**Never call `element.focus()` bare** — `moveFocusTo(element)` is the one way
to move the focus, in navi and in an app using navi:

```js
moveFocusTo(target);
```

It states the two answers a bare `focus()` leaves to the browser:

- `focusVisible` is the **modality of what asked for the transfer**, never the
  state of the element handing over. That element is often no witness at all: a
  trigger whose mousedown was prevented keeps a `:focus-visible` nobody can
  see, and something focused by code was itself focused without a ring, so it
  would report "no ring" for a movement asked for with a key.
- An **editable target outranks the modality**: a field one is about to type in
  draws its ring on any focus, so the native `:focus-visible` is told the same
  rather than left to disagree with what navi paints.
- `preventScroll` is on because the browser's scroll-into-view reads geometry
  that navi's own layout effects are often still deciding.

Both are overridable, and both overrides are for a caller who knows something
the last interaction does not — a transfer speaking for the gesture that opened
a container, an element that genuinely has to be scrolled into view. Neither is
a way to skip thinking about the question.

**Never pick the target by hand.** Who receives the focus is one ladder, and it
knows things a `querySelector` does not: the marks that ask for it, the ones
that only take it back, the ones that take it for want of anything better,
what is inert, hidden from assistive technology, or delegating elsewhere. A
component that walks the DOM itself will disagree with the rest of navi, and
the disagreement shows up as "the focus went somewhere else in this one
component".

**The mark is `navi-autofocus`, never the native `autofocus` attribute.** The
native one fires its own scroll before layout effects have run, and there is no
way to keep the focus while suppressing the scroll.

**A container that opens or arrives transfers**, rather than focusing something
itself: the transfer carries the ladder, the restore marks (coming back to a
container returns to where the user was in it), the policy for a coarse pointer
— where an arrival must not raise a virtual keyboard over what it just showed —
and the second try for content that was not built yet.

**The focus goes back before its holder leaves, and only to something that
stays.** Removing the element that holds the focus is not silent: Chrome fires
`blur` and a `focusout` with no `relatedTarget` that bubbles through whatever
still contains it — to any listener, the focus just left for nowhere (a popover
closing when the focus leaves it closes). So a surface that closes hands the
focus back _before_ its element is taken out. The one exception is a close
caused by an unmount: it runs from a cleanup while the tree leaving with it is
still in the document, and the element to give the focus back to may be leaving
in the same commit — focused, it makes the removal of its whole subtree restyle
it. That hand-back waits for the commit (a microtask), gives the focus only to
an element still connected, and only into a void: whatever took the focus in
the meantime (the page arriving, focusing a field of its own) keeps it.
_Reference: `giveFocusBackAfterCommit` in utils/focus/focus_transfer.js, used by
the callout manager and by every popup's close (layout/open_controller.js)._

The browser hands the focus back on its own, and never waits: `dialog.close()`
focuses whatever held the focus before `showModal()` — even from `<body>` —
and `hidePopover()` does the same for a popover holding it. Removing either
from the document hands it to nobody. So a popup closing because it leaves
the tree does not close natively on the spot: a `<dialog>` is closed once the
commit is over (its removal took it out of the top layer; what remains is its
`open` attribute, which a subtree parked by `<Suspense>` would otherwise show
again), and a popover is left to its removal. _Reference: the close cleanups
in layout/dialog.jsx and layout/popover.jsx._

**Departing from that policy is allowed, and has to be argued in place.** The
coarse-pointer rule is about arrivals: something appears and the user reads it.
A press on a control whose whole purpose is to reach a field is not that, and
may take the keyboard. What is not acceptable is departing silently: the next
reader has to be able to tell a decision from an oversight.

**Write `:focus-visible` / `[data-focus-visible]` in CSS and nothing else.**
navi implements both with enriched semantics — an element also counts as
focused when a proxy or a controlling element (`aria-controls`) holds the focus
— under the native names on purpose, so every existing selector benefits. A
navi-specific pseudo-class would mean updating every component.

## Where it lives

- `src/utils/focus/focus_transfer.js` — `moveFocusTo`, the ladder
  (`findFocusTarget`), the transfer (`prepareFocusTransfer`), the restore
  marks, the retry.
- `src/utils/focus/use_auto_focus.js` — what writes `navi-autofocus`, and why
  the native attribute is not used.
- `src/box/pseudo_styles.js` — `isKeyboardModality`, `isEditableTarget`, and
  the enriched `:focus` / `:focus-visible`.
- `docs/autofocus.md` — the same decisions told to whoever uses navi.
- `src/control/control_swap/control_swap.jsx` — a deliberate departure from the
  coarse-pointer policy, argued next to the code.
