# Travelling: a hand, a screen, and who owns the gesture

A travel is a hand pushing a whole screen aside to bring in the next one. There
are two families, and they do not work the same way:

- **A row of screens** (`SlideContainer`, `RouteTravel`) is a real scroller with
  one snap point per screen. The browser reads the hand. See
  [The browser scrolls the row](#the-browser-scrolls-the-row).
- **A box pushed aside** (a docked `Dialog` or a `SidePanel` pushed back to close
  it, a row swiped with `interactions`) has nothing to scroll to, so the press is
  read by one module, `drag_to_travel.js` in @jsenv/dom. See
  [A box pushed aside: the press](#a-box-pushed-aside-the-press).

What an application has to know is who gets a press that lands inside such a
box. It is decided before anything moves, so read
[Who owns a gesture](#who-owns-a-gesture) before putting anything that reads
the pointer inside a box that travels.

- [The browser scrolls the row](#the-browser-scrolls-the-row)
- [A box pushed aside: the press](#a-box-pushed-aside-the-press)
- [Who owns a gesture](#who-owns-a-gesture)
  - [Boxes inside boxes](#boxes-inside-boxes)
  - [Something being carried inside a box](#something-being-carried-inside-a-box)
  - [A surface in the top layer](#a-surface-in-the-top-layer)
  - [A navi component that reads the pointer marks ITSELF](#a-navi-component-that-reads-the-pointer-marks-itself)
  - [What is contained, and what still leaks](#what-is-contained-and-what-still-leaks)
- [The two rows](#the-two-rows)

## The browser scrolls the row

A touch pans on the compositor, a trackpad follows the fingers, a wheel is read
for what it is. So a row answers a hand the way any scroll snap carousel on the
web does, and these are its rules, not ours:

- **A trackpad or a finger holds the screen.** Let go past half the box, or with
  momentum, it goes; let go short of that with the hand at rest, it comes back.
- **One notch of a wheel is one screen**, however small the notch. Only the
  browser can tell a notch from a trackpad: the page cannot.
- **A big swipe can cross more than one screen.** `scroll-snap-stop` stops the
  momentum at the next screen, not a finger still pushing past it. With
  `mount="near"`, a screen reached ahead of its neighbours is built on the way, so
  it can show empty for a moment.
- **A stroke stays on what it started on.** A vertical scroll cannot change
  screen, whatever it leans towards on the way. The price is the mirror case: a
  stroke that opens on a sideways crumb is the row's, and the vertical scroll it
  turns into does nothing until the hand lifts.
- **A mouse does not drag**, as it does not scroll anything else on the web.

What stays ours:

- **A travel asked for** (a tab, a key, a command, a state) plays in `duration`,
  one box long whatever the distance, in `SlideContainer`. In `RouteTravel` it is
  the browser's smooth scroll.
- **A direction that is refused is the end of the row.** Whatever holds the user
  where they are (a `<Slide required>` waiting for its answer, a `preventNavNext`)
  takes what lies beyond off the row, so nothing can be scrolled to. There is no
  screen walked to and then taken back.
- **What a box cannot say to a scroller is said per axis.** `travelByDrag` is about
  a finger, `travelByScroll` about a wheel or a trackpad: off on an axis, that hand
  is handed on to what scrolls inside, then around.

**`position: sticky` does not stick inside a `RouteTravel` row of two pages or more
while the document scrolls.** A horizontal scroller cannot let the other axis
through, so the row is what sticky sticks to, and the row never scrolls vertically.
A page that scrolls by itself inside the row is not concerned.

## A box pushed aside: the press

- A press is not a gesture until it has wandered 10px with a mouse, 6px with a
  finger or a pen, and the axis it leans on then is the axis it walks, for good.
  The reading leans towards the box's own axis: a thumb swiping sideways moves
  along an arc, and its first pixels lean off-axis far more than the swipe does,
  so the cross axis takes the press only when it clearly dominates. Where
  something under the finger scrolls on that axis, the page included, the reading
  is even, the way the browser's is: a scroll that wobbles stays a scroll, and a
  swipe whose first pixels are steeper than 45° scrolls too. A finger's 6px is a
  deadline rather than a feel: the browser commits a touch to its own pan about
  8px in, and whatever is read after that is read about a pointer it has already
  cancelled (see
  [mobile_touch.md](./mobile_touch.md#the-browser-decides-about-8px-in-and-does-not-wait)).
  Its price is the click of a tap that shook more than 6px.
- **Letting go asks where the hand is about to put things.** Where the box stands,
  plus half a second at the speed the fingertip has as it lifts, against half the
  box. A flick lands far and goes. A hand thrown back lands short and everything
  goes back. A hand that slowed to a stop has no speed left, and the picture
  answers alone. Speed counts from 25px of finger, a tap that slipped not being a
  flick, and past 0.4 px/ms it answers on its own, or half a wide box would be out
  of reach of any flick.
- Pulling towards nothing follows the finger at a fraction of its distance and
  comes back: a wall one can lean on, never walk through.

How to drive a gesture without a device, and why the obvious way hides the race
that loses swipes on a phone, is
[mobile_touch.md](./mobile_touch.md#verifying-without-a-device).

## Who owns a gesture

A row of screens leaves this to the browser, which hands a touch to the innermost
scroller that can take it. A box pushed aside reads it itself: five things can
claim a pointer that landed on it, and all five are read at the press, before the
box moves:

1. **What says so itself.** What the browser already answers the pointer on — a
   field, a `contenteditable`, a `select`, a range; a dedicated drag handle
   (`data-drag-handle`); anything carrying `data-no-drag-travel`; an element
   whose `selfInteractions` names `drag` or `"*"` (see
   [interactions.md](./interactions.md#an-affordance-inside-somebody-elses-box-selfinteractions));
   and a popover or a `<dialog>` inside the box, which is a layer over it. A
   button, a link or a checkbox is not among them on purpose: a drag from one
   travels, and the click it would have made is swallowed before any listener
   hears it, the ancestors' included: an `onClick` on something that travels
   needs no distance check of its own. For the same reason
   navi refuses the browser's own drag of a link or an image for that press: it
   starts a few pixels in and would take the pointer before the travel forms.
   An app that wants an image dragged out of the page marks it
   `data-no-drag-travel`. A field that only reads the press — a picker's façade
   is an `<input>` that opens a popup — says so with `data-press-only`, and a
   travel starts there like anywhere else.
2. **A scroller in between with room left that way.** It keeps the gesture until
   it has no room left, and only then hands the travel over — so a row that
   scrolls sideways inside a page still scrolls sideways. A row swiped with
   `interactions` is the exception: its swipe does not ask.
3. **Another travelling box in between** — see
   [Boxes inside boxes](#boxes-inside-boxes).
4. **Something in between that is picked up and carried** — see
   [Something being carried inside a box](#something-being-carried-inside-a-box).
5. **A surface in the top layer in between** — see
   [A surface in the top layer](#a-surface-in-the-top-layer).

And one thing narrows it from the other end: a docked `Dialog` reads the press
only on its grip — its header, plus anything carrying `data-swipe-grip` — so a
board, a map or a list it holds keeps its own gestures, and a sheet with neither
is not pushed back at all. A `SidePanel` is pushed from its whole surface.

### Boxes inside boxes

A row of slides inside a page that walks between pages, a carousel inside a
carousel, a `SlideContainer` inside a `RouteTravel`: the innermost is the one the
hand is pointing at. It takes the gesture on the axis it walks, and the boxes
around it keep whatever axis it does not, so a row swiped sideways inside a column
of screens keeps the sideways gesture, and the column still answers a finger going
down.

Decided when the stroke starts, once and for all. An inner row sitting on its last
slide does not hand the gesture over: it leans on its wall, the way it does when
it is alone. Travelling the box around it means starting the gesture outside it. A
box pushed aside reads the axes of what is inside it in the DOM
(`data-travel-by-drag`).

When the boxes say ONE place between them — a row of titles in each slide of a
column of levels, the address naming a title — they bind one state: see
[state_binding.md](./state_binding.md#a-control-that-shows-part-of-a-bigger-answer).

### Something being carried inside a box

A drag (`interactions={{ move, reorder, land, toss, leave }}`, see
[drag_interactions.md](./drag_interactions.md)) reads the same press a travel
does and holds the pointer from it, so the two share a finger exactly as two
travelling boxes do: what is picked up says which axes it walks, and the box
above keeps what is left. A list reordered along its own line inside a row of
slides swiped sideways: both gestures live, and neither had to be told about the
other.

When the two want the same axes — a piece carried both ways inside a sheet
pushed down to close it — nothing is left and the press is the piece's, whole.
That is the right way round: the box above is a surface, and the thing in it is
what the hand came for.

Something that is NOT free to be carried takes nothing: `move: "refuse"` walks
no axis, so a swipe that starts on it is the swipe of the box it stands in (see
[drag_interactions.md](./drag_interactions.md#the-hand-pulls-and-nothing-follows-refuse)).
A dedicated handle (`data-drag-handle`) is the opposite case: it has no axis, it
is a place whose only purpose is to be taken hold of, so it takes the press
outright.

### A surface in the top layer

A popover, a modal `<dialog>`, an element gone fullscreen: it is written inside
whatever opened it — a slide, a page that travels — and the browser paints it
over the whole screen. The DOM says "inside", the eye says "on top of", and the
gesture belongs to what the eye sees: a drag across a full-screen dialog opened
from a slide is not a drag on the slides, and nothing about it should reach
them.

So every walk up from the pointer stops there. The boxes above the surface get
no axis, and a scroller above it gets nothing either — it is painted behind the
surface, and behind is not under the finger. `showModal()` does not do this on
its own: the rest of the document is made inert, but the press still bubbles out
of the (not inert) dialog to a listener that sits above it.

### A navi component that reads the pointer marks ITSELF

`data-no-drag-travel` is written by the component that takes the pointer, never
by whoever puts it in a page. The caller cannot know — a `Table` whose columns
can be dragged, a `Wheel` spun with a thumb, a canvas one draws on all look like
ordinary content from outside — and will not find out until they watch a page
leave under their finger. The component knows, so the component says it.

The rule is the application's too: a component of yours that reads the pointer
by hand, rather than through `interactions`, marks its own element
`data-no-drag-travel`.

### What is contained, and what still leaks

A travel must not take the page with it: a list inside the box that reaches its
end must not scroll the page behind the travel, and the page must not bounce, or
go back in history, under a screen being dragged. navi says so on everything it
knows scrolls inside a travelling box — the box itself, a `Box` that asked for
an `overflow`, and the scrollers a browser makes on its own (a `textarea`, a
`select` showing a list; an empty one too, so on Blink a wheel over it moves
nothing rather than the list around it). It is written once and for all rather
than while a finger is down, because a browser decides what a gesture may do
when the gesture begins; the bounce is refused only while a gesture runs, so a
page that bounces the rest of the time goes on bouncing.

What still leaks, only on Blink (Chrome, Edge), and only under a box pushed aside,
which is not a scroll container: a scroller **nobody declared and no tag names** —
a bare `<div style="overflow: auto">`, a widget from elsewhere. Its leftovers
reach the page. Two ways out, per case: give the scroller a `Box` with an
`overflow` (it is then declared), or contain it by hand
(`overscroll-behavior-x: contain` under a box travelling sideways). The general
fix belongs to Blink.

A row of screens is a scroll container, and contains itself.

## The two rows

|                               | `SlideContainer`                  | `RouteTravel`                               |
| ----------------------------- | --------------------------------- | ------------------------------------------- |
| what the screens are          | `<Slide>`s in one box             | routes                                      |
| what says which is here       | a `signal`, `current` / a command | the URL                                     |
| what a screen not on it shows | itself, built or `mount="near"`   | itself once visited; before that, see below |
| what says the order           | the layout map                    | the `<Route>` children, or `routes`         |
| a travel asked for            | plays in `duration`, one box long | the browser's smooth scroll                 |

A `RouteTravel` page not visited yet can only be built by the address moving, since
a route's actions ask only while it matches. So the address moves once the hand has
really pulled, 16px, and the page fills in under the finger. See
[navigation.md](./navigation.md#tabs-that-travel-routetravel).

Both tell what follows them how far the row has come. `SlideContainer` writes
`--slide-travel-progress` (where the picture stands against the slide it counts
from, in boxes: 0 on it, +1 a whole box before it, -1 one after) on its box, for
anything drawn inside it, and on every element marked
`data-slide-container-follows={id}` outside it, a tab bar above the box. It counts
from the current slide (`data-slide-current`), or once a hand has carried the row
past it from `data-slide-travel-base`, towards `data-slide-travel-toward`.
`RouteTravel` needs nothing: a `<Nav currentIndicator>` draws its bar under the hand
for any row it holds tabs for.
