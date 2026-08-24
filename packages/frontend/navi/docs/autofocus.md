# Where the keyboard goes when something opens

A dialog, a popover, a slide arriving: one of them opens and something inside
has to hold the keyboard. `autoFocus` is how each element takes part in that
decision.

- [What we want](#what-we-want)
- [The ladder](#the-ladder)
- [A popup that is read before it is filled](#a-popup-that-is-read-before-it-is-filled)
- [The most precise wins](#the-most-precise-wins)
- [Docked on a small touch screen: fields are withdrawn](#docked-on-a-small-touch-screen-fields-are-withdrawn)
- [What a field says about itself](#what-a-field-says-about-itself)
- [When the opening places nothing](#when-the-opening-places-nothing)

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
2. the first `autoFocus` — "put it here";
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

`autoFocus` on a field beats `autoFocus` on the surface around it (step 2 above
comes before step 4). The two can be stated together without a conflict to
resolve: the surface says where the focus goes by default, a field that really
is what the user came for says so itself.

```jsx
<Dialog autoFocus>
  <Text>Search the catalog</Text>
  <Input name="query" autoFocus /> {/* … except here */}
</Dialog>
```

## Docked on a small touch screen: fields are withdrawn

A `Dialog` with `dockedOnSmallTouchScreen` becomes a bottom sheet on a phone —
the one shape the keyboard hurts most, since the sheet starts at the very edge
the keyboard covers. There, step 3 of the ladder does not consider fields at
all: rather than the first text input it finds, the opening falls through to
what remains, usually the surface itself.

Nothing to pass, and nothing to remember per call site. A field that wants the
keyboard on a phone still says so with its own `autoFocus`, which is where that
decision belongs.

## What a field says about itself

- `autoFocus` — "I am what the user came for". A picker's search box on a
  desktop, the one field of a one-field popup.
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

What arrives a moment later is allowed to take it: an opening that placed
nothing owes the focus to whatever appears next, and an `autoFocus` in that
content is honored rather than deferring to a transfer that never happened.
Without this, the same popup would land the focus in a different place — or
nowhere — depending on whether it was opened by a click or by the page loading,
which is the same popup behaving differently for no reason the user can see.
