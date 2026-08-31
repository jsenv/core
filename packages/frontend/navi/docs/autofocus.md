# Where the keyboard goes, and when a ring shows

A dialog, a popover, a slide arriving: one of them opens and something inside
has to hold the keyboard. `autoFocus` is how each element takes part in that
decision. Handing the focus over answers a second question at the same time —
whether what receives it shows a focus ring — and navi answers that one too,
at the end of this page.

- [What we want](#what-we-want)
- [The ladder](#the-ladder)
- [A popup that is read before it is filled](#a-popup-that-is-read-before-it-is-filled)
- [The most precise wins](#the-most-precise-wins)
- [On a touch device: the surface is what one arrives on](#on-a-touch-device-the-surface-is-what-one-arrives-on)
  - [Opting a field back in](#opting-a-field-back-in)
- [What a field says about itself](#what-a-field-says-about-itself)
- [When the opening places nothing](#when-the-opening-places-nothing)
- [The ring is decided too](#the-ring-is-decided-too)
- [Moving the focus yourself](#moving-the-focus-yourself)

## What we want

The focus is where the user is. So an opening has to answer one question — what
did the user come here to do? — and the answer is rarely "type": a picker opens
on its search box, but a popup that explains something opens on the explanation.

On a phone the difference is not a nuance. Focusing a field raises the virtual
keyboard, the keyboard takes a third of the height, and the popup scrolls the
focused field into what is left. Everything above it — the title, the sentence
saying why the field is asked for — is already past the top edge when the user
first looks at the popup. Nobody scrolls back up to read what they were never
shown, so a popup that opens on its field is a popup whose text does not exist.

Hence the rule: **the surface is read, then touched.** The keyboard rises when
the user asks for it, or when a field says it is what the user came for.

## The ladder

Whoever hands out the focus — a popup opening, a slide arriving — tries these
in order, and stops at the first that leads somewhere focusable:

1. the element that held the focus when this container was last closed;
2. the first `autoFocus` — "put it here". The container's own comes last here,
   so a field naming itself wins over the surface around it;
3. the first focusable element — what one came to do;
4. the deepest `autoFocus="last-resort"`, the container itself included;
5. nothing, and the caller decides what that means.

Step 1 is why reopening a popup comes back to where the user was, rather than to
what the content asks for on a fresh open.

## A popup that is read before it is filled

`autoFocus` (the plain boolean `true`) on the `Dialog`/`Popover` itself:

```jsx
<Dialog autoFocus>
  <Heading>Almost there</Heading>
  <Text>We need a first name so the others know who joined.</Text>
  <Input name="first_name" />
</Dialog>
```

The focus lands on the surface, which is focusable for exactly this
(`tabIndex={-1}`). No keyboard rises, nothing is scrolled, and Tab starts from
the beginning of the reading order — the user reads, then reaches the field by
the route the content lays out.

This is the value to reach for whenever the popup's first job is to say
something. It is not the same as `"last-resort"`, which is the default and means
the opposite: "anything in here before me".

## The most precise wins

`autoFocus` on a field beats `autoFocus` on the surface around it: both are step
2 of the ladder, and the container's own mark is tried last there. The two can
be stated together without a conflict to resolve — the surface says where the
focus goes by default, a field that really is what the user came for says so
itself.

```jsx
<Dialog autoFocus>
  <Text>Search the catalog</Text>
  <Input name="query" autoFocus /> {/* … except here */}
</Dialog>
```

## On a touch device: the surface is what one arrives on

Where the keyboard is a virtual one — anything answering `pointer: coarse` — an
arrival drops step 3 of the ladder entirely: the focus goes where something
ASKED for it, and otherwise to the surface itself.

Every arrival, not just a popup opening. A slide travelling in (so a
`RouteTravel` screen too) hands out the focus the same way and loses the same
thing by landing on the first focusable — more of it, even, a screen having more
above the fold than a popup. Its surface is the `SlideContainer` box, which is
what takes the keyboard when the slide holds nothing that can, so the arrows
keep working from there.

The condition is the device, not the shape of what arrives and not the gesture
that brought it. A virtual keyboard is a fact about the screen: it costs a third
of the height whatever raised it, and an arrival with no pointer in it at all —
a popup opened by the page loading, a travel asked for by code — is exactly the
one that must not be answered "no keyboard here". Docking only makes the cost
more visible (a bottom sheet is short, so there is less room to lose before the
title goes), it is not what creates it.

Withdrawing only the FIELDS would not be enough either. The first focusable is
wherever the content happens to put it — and in a popup that explains before it
asks, what comes first is the explanation, so the first focusable is far down:
the terms checkbox, the submit button. Landing there scrolls the popup to it and
the title is above the top edge again, keyboard or no keyboard. The cause
changes, the user sees the same thing.

Nothing to pass, and nothing to remember per call site.

### Opting a field back in

Some popups — and some screens — really are opened to type in: one comment box,
one rename field.
There, the field says so itself, and that beats the device — step 2 of the
ladder comes before step 3 was ever skipped.

```jsx
<Dialog>
  <Heading>Leave a comment</Heading>
  <Textarea name="comment" autoFocus />
</Dialog>
```

Worth saying out loud before writing it: a popup holding one field is not
necessarily a popup opened to fill it — it is often opened to READ what the
field holds, and raising the keyboard over it then costs the reading for nothing.
The default answers that case; `autoFocus` on the field answers the other, and
saying which is which is the caller's to make because nothing about the markup
can tell them apart.

## What a field says about itself

- `autoFocus` — "I am what the user came for". A picker's search box, the field
  of a popup opened to type in it. It holds on a touch device too: it is how a
  field opts back into a keyboard the surface would otherwise keep down.
- `autoFocus="restore"` — "never on a fresh open, but bring me back". A field
  the user was typing in when a popup over it closed: reopening returns to it,
  opening for the first time does not raise a keyboard on it.
- `autoFocus="last-resort"` — "anything else in here before me". Said by a poor
  place to arrive that is still better than nowhere: a close button, a chevron.
  A container says it about its own contents, which is the default for
  `Dialog`/`Popover`.

## When the opening places nothing

A popup can open on content that holds nothing focusable yet — content still
being built, a screen not yet interactive. The ladder then comes back empty and
the opening places no focus at all.

That debt is settled two ways, whichever comes first:

- what arrives a moment later takes it — an `autoFocus` in content built during
  the opening is honored, rather than deferring to a transfer that never
  happened;
- failing that, the ladder is walked once more, one microtask later, still
  before the browser paints and long before the user can do anything. A surface
  that says `autoFocus` about itself is placed by that second try.

Without this, the same popup would land the focus in a different place — or
nowhere — depending on whether it was opened by a click or by the page loading,
which is the same popup behaving differently for no reason the user can see.

## The ring is decided too

Handing the focus over answers a second question: does what receives it show a
focus ring? The browser's own answer is unusable here — it reads the last thing
that touched the DOM, and a focus that came from code touched it last. So navi
answers instead, and the answer is the **modality of what asked**:

- the user was on the keyboard when this was asked for — a Tab, an Enter, an
  arrow key: a ring;
- a finger or a mouse asked: no ring, whatever the code did in between;
- the element receiving it is **editable** — a text input, a textarea, a
  contenteditable: a ring anyway. Someone about to type has to see where.

That last one is why opening a search field with a mouse click still rings: the
field is where you are about to type, not somewhere you merely landed.

Nothing to pass, and nothing to opt into: it is how every navi component moves
the focus.

### In your CSS

`:focus-visible` and `[data-focus-visible]` — the standard selectors, nothing
navi-specific. navi implements them with a wider meaning than the browser's: an
element also counts as focused while a **proxy** holds the focus (a read-only
range delegating to a sibling) or while an element **controlling** it does (a
combobox input with `aria-controls` on its listbox — the listbox reads as
focused while the input is). Style the standard name and you get that for free.

```css
.my_row:focus-visible {
  outline: 2px solid var(--navi-focus-outline-color);
}
```

## Moving the focus yourself

Prefer saying where the focus belongs over moving it: `autoFocus` on the field
or the surface (the ladder above), and navi places it at the right moment, with
the right ring, without scrolling anything.

When you really do have to move it — a control of your own handing over to
another — use `moveFocusTo` rather than `element.focus()`:

```js
import { moveFocusTo } from "@jsenv/navi";

moveFocusTo(searchInputElement);
```

That is the whole call. It applies the two decisions above for you: no
scroll-into-view, and a ring only where the user is on the keyboard (an
editable target ringing anyway). A bare `element.focus()` answers "who" and
leaves "is this visible" to the browser, and the browser reads the last thing
that touched the DOM — which was your own call.

Pass `focusVisible` when you know better than the last interaction does, and
`preventScroll: false` when the element really has to be brought into view:

```js
moveFocusTo(element, { focusVisible: true });
```
