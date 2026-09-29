# Where the keyboard goes, and when a ring shows

A dialog, a popover, a slide arriving: one of them opens and something inside
has to hold the keyboard. `autoFocus` is how each element takes part in that
decision. Handing the focus over answers a second question at the same time —
whether what receives it shows a focus ring — and navi answers that one too, at
the end of this page.

- [What we want](#what-we-want)
- [The ladder](#the-ladder)
- [A popup that is read before it is filled](#a-popup-that-is-read-before-it-is-filled)
- [The most precise wins](#the-most-precise-wins)
- [On a touch device: the surface is what one arrives on](#on-a-touch-device-the-surface-is-what-one-arrives-on)
  - [Opting a field back in](#opting-a-field-back-in)
- [What a field says about itself](#what-a-field-says-about-itself)
- [When the opening places nothing](#when-the-opening-places-nothing)
- [The ring is decided too](#the-ring-is-decided-too)
- [When a popup closes](#when-a-popup-closes)
- [Moving the focus yourself](#moving-the-focus-yourself)

## What we want

The focus is where the user is. So an opening has to answer one question — what
did the user come here to do? — and the answer is rarely "type": a popup that
explains something opens on the explanation.

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
2. the first `autoFocus` — "put it here", the container's own tried last;
3. the first focusable element — what one came to do;
4. one `autoFocus="last-resort"`: the first found that holds no other, the
   container's own only when nothing inside says it;
5. what held the focus before the opening (the trigger, for a press): the focus
   stays outside, and
   [when the opening places nothing](#when-the-opening-places-nothing) says what
   follows.

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
itself, on a touch device too.

```jsx
<Dialog autoFocus>
  <Text>Search the catalog</Text>
  <Input name="query" autoFocus /> {/* … except here */}
</Dialog>
```

## On a touch device: the surface is what one arrives on

Where the keyboard is a virtual one — anything answering `pointer: coarse` — an
arrival drops step 3 of the ladder entirely: the focus goes where something
ASKED for it, and otherwise to the surface itself. Step 4 still runs, though: a
`last-resort` inside is picked before a surface that is only `last-resort`
itself, the default — a chevron marked so takes the focus, and a field marked
so raises the keyboard.

Every arrival, not just a popup opening. A slide travelling into a
`SlideContainer` hands out the focus the same way and would lose the same thing
by landing on the first focusable — more of it, even, a screen having more above
the fold than a popup. Its surface is the `SlideContainer` box, which takes the
keyboard when the slide holds nothing that can, so the arrows keep working from
there.

The condition is the device, not the shape of what arrives and not the gesture
that brought it. A virtual keyboard costs a third of the height whatever raised
it, and an arrival with no pointer in it at all — a popup opened by the page
loading, a travel asked for by code — is exactly the one that must not be
answered "no keyboard here". Withdrawing only the fields would not do either: in
a popup that explains before it asks, the first focusable is far down (the terms
checkbox, the submit button), and landing there scrolls the title away, keyboard
or no keyboard.

### Opting a field back in

Some popups — and some screens — really are opened to type in: one comment
box, one rename field. There, the field says so itself, and that beats the
device — step 2 of the ladder comes before step 3 was ever skipped.

```jsx
<Dialog>
  <Heading>Leave a comment</Heading>
  <Textarea name="comment" autoFocus />
</Dialog>
```

A popup holding one field is not necessarily a popup opened to fill it — it is
often opened to READ what the field holds, and raising the keyboard over it then
costs the reading for nothing. Nothing about the markup tells the two apart, so
saying which is the caller's.

## What a field says about itself

- `autoFocus` — "I am what the user came for": the field of a popup opened to
  type in it.
- `autoFocus="restore"` — "never on a fresh open, but bring me back". A field
  the user was typing in when a popup over it closed: reopening returns to it,
  opening for the first time does not raise a keyboard on it.
- `autoFocus="last-resort"` — "anything else in here before me". Said by a poor
  place to arrive that is still better than nowhere: a close button, a chevron.
  A container says it about its own contents, which is the default for
  `Dialog`/`Popover`.

## When the opening places nothing

A popup can open on content that holds nothing focusable yet — content still
being built, a screen not yet interactive. The ladder then places nothing inside
it, and that debt is settled two ways, whichever comes first:

- what arrives a moment later takes it — an `autoFocus` in content built during
  the opening is honored, rather than deferring to a transfer that never
  happened;
- failing that, the ladder is walked once more, one microtask later, still
  before the browser paints and long before the user can do anything. A surface
  that says `autoFocus` about itself is placed by that second try.

So the same popup places the focus the same way whether a click or the page
loading opened it.

## The ring is decided too

Handing the focus over answers a second question: does what receives it show a
focus ring? The browser's own answer is unusable here — it reads the last thing
that touched the DOM, and a focus that came from code touched it last. So navi
answers instead, and the answer is the **modality of what asked**:

- the user was on the keyboard when this was asked for — a Tab, an Enter, an
  arrow key: a ring;
- a finger or a mouse asked: no ring, whatever the code did in between;
- the element receiving it is **editable** — a text input, a textarea, a
  contenteditable: a ring anyway. Someone about to type has to see where, so
  opening a search field with a mouse click still rings.

The ladder answers it this way, and so does `moveFocusTo`
([below](#moving-the-focus-yourself)).

### In your CSS

Navi's "focused" is wider than the browser's: an element counts as focused while
an element **controlling** it holds the focus (a listbox, while the combobox
input with `aria-controls` on it does), and a **proxy** — the visible stand-in
for a hidden real control — while its real control does. That meaning lives in
`[data-focus-visible]`, the attribute navi writes on an element tracking the
pseudo-class: navi's own controls, and a `Box` of yours once its `style` holds a
`":focus-visible"` key. A native `:focus-visible` rule only gets the browser's
behaviour.

```css
.my_row[data-focus-visible] {
  outline: 2px solid var(--navi-focus-outline-color);
}
```

## When a popup closes

The focus goes back to what held it when the popup opened — the trigger, most
of the time — so the user carries on where they were.

A popup that closes because it **leaves the tree** — its component unmounted,
the page holding it left — gives the focus back once that change is over, and
only to an element still in the document: the trigger often leaves in the same
render, and focusing it just before it goes would be focusing nothing (and
making its removal cost more). It gives the focus back only into a void, too:
when something else took the focus meanwhile — the page arriving, focusing a
field of its own — that one keeps it.

So `{editing && <Dialog open>…</Dialog>}` unmounted from a button inside it
lands the focus back on the button that opened it, and a dialog left along with
the page around it lands it nowhere (`<body>`), exactly as if the page had
simply been removed.

## Moving the focus yourself

Prefer saying where the focus belongs over moving it: `autoFocus` on the field
or the surface (the ladder above), and navi places it at the right moment, with
the right ring, without scrolling it into view.

When you really do have to move it — a control of your own handing over to
another — use `moveFocusTo` rather than `element.focus()`. A bare `.focus()`
answers "who" and leaves "is this visible" to the browser, which reads the last
thing that touched the DOM — your own call. `moveFocusTo` applies both decisions
above, no scroll-into-view and the ring of the modality:

```js
import { moveFocusTo } from "@jsenv/navi";

moveFocusTo(searchInputElement);
```

`focusVisible` is for when you know better than the last interaction does, and
`preventScroll: false` for an element that really has to be brought into view.
