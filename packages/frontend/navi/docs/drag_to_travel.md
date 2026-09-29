# Travelling by drag, and who owns the gesture

A travel is a pointer or a wheel pushing a whole screen aside to bring in the
next one: slides inside a box (`SlideContainer`), pages that are URLs
(`RouteTravel`), a docked `Dialog` or a `SidePanel` pushed back the way it came
to close it, a row swiped aside with `interactions`. One module answers what
such a gesture IS — `drag_to_travel.js` in @jsenv/dom — and all of them read
it, so a hand never has to learn two sets of numbers.

What an application has to know is who gets a press that lands inside such a
box. It is decided at the press, from the DOM, before anything moves — so read
[Who owns a gesture](#who-owns-a-gesture) before putting anything that reads
the pointer inside a box that travels.

- [What the rules are](#what-the-rules-are)
- [Who owns a gesture](#who-owns-a-gesture)
  - [Boxes inside boxes](#boxes-inside-boxes)
  - [Something being carried inside a box](#something-being-carried-inside-a-box)
  - [A surface in the top layer](#a-surface-in-the-top-layer)
  - [A navi component that reads the pointer marks ITSELF](#a-navi-component-that-reads-the-pointer-marks-itself)
  - [What is contained, and what still leaks](#what-is-contained-and-what-still-leaks)
- [The two consumers that travel between screens](#the-two-consumers-that-travel-between-screens)
  - [One gesture that bar cannot follow](#one-gesture-that-bar-cannot-follow)

## What the rules are

- A press is not a gesture until it has wandered 10px with a mouse, 6px with a
  finger or a pen, and the axis it leans on then is the axis it walks, for good:
  a diagonal would ask for two travels at once when only one screen can arrive.
  The reading leans towards the box's own axis — a thumb swiping sideways moves
  along an arc, and its first pixels lean off-axis far more than the swipe does
  — so the cross axis takes the press only when it clearly dominates, and a
  scroll, near-pure on its axis from the first pixel, still leaves whole. A
  finger's 6px is a deadline rather than a feel: the browser commits a touch to
  its own pan about 8px in, and whatever is read after that is read about a
  pointer it has already cancelled (see
  [mobile_touch.md](./mobile_touch.md#the-browser-decides-about-8px-in-and-does-not-wait)).
  Its price is the click of a tap that shook more than 6px.
- **A hand still moving when it lets go says where this goes, and it says it
  both ways.** Towards what it was bringing in, the travel carries on, however
  slowly, once it has pulled a few pixels. Away from it, fast, everything goes
  back whatever the distance already covered — otherwise a screen caught in
  flight and thrown back still arrives. Only a release at rest is judged by the
  picture: about a third of the box.
- Pulling towards nothing follows the finger at a fraction of its distance and
  comes back: a wall one can lean on, never walk through.
- **A direction that will be refused is one of those walls, and it must be a
  wall from the first pixel.** Whatever holds the user where they are — a
  `<Slide required>` waiting for its answer, a `preventNavNext` — is read where
  the gesture is ARMED, not only when it is let go of. Read at the release
  alone, the screen one may not reach is walked to, read on the way, and then
  taken back: a wall that shows what is behind it and pushes you back reads as a
  bug even when it is a rule. What a lock answers is therefore not "is there a
  screen that way" but "may I go there".
- **A hand that walks a whole box and keeps going is asking for the next one**,
  and the gesture walks on into it without being let go of.
- **A wheel push moves one screen**, the way an arrow key does — never a
  distance. What keeps arriving after the fingers are gone is momentum and is
  not counted: a second screen takes a second push, or one that insists.
- **A press on a travel still moving is the next swipe first.** A step the way
  it is going asks for the screen after, and the travel goes on there without
  ever having stopped; only a step against it, or a finger saying nothing for
  about 100ms, catches it where it stands. Let go before either — a tap — and
  the travel was never touched.

How to drive a gesture without a device, and why the obvious way hides the race
that loses swipes on a phone, is
[mobile_touch.md](./mobile_touch.md#verifying-without-a-device).

## Who owns a gesture

Five things can claim a pointer that landed on a travelling box, and all five
are read at the press, before the box moves:

1. **What says so itself.** What the browser already answers the pointer on — a
   field, a `contenteditable`, a `select`, a range; a dedicated drag handle
   (`data-drag-handle`); anything carrying `data-no-drag-travel`; an element
   whose `selfInteractions` names `drag` or `"*"` (see
   [interactions.md](./interactions.md#an-affordance-inside-somebody-elses-box-selfinteractions));
   and a popover or a `<dialog>` inside the box, which is a layer over it. A
   button, a link or a checkbox is not among them on purpose: a drag from one
   travels, and the click it would have made is swallowed. A field that only
   reads the press — a picker's façade is an `<input>` that opens a popup — says
   so with `data-press-only`, and a travel starts there like anywhere else.
2. **A scroller in between with room left that way.** It keeps the gesture until
   it has no room left, and only then hands the travel over — so a row that
   scrolls sideways inside a page still scrolls sideways.
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
carousel, a `SlideContainer` inside a `RouteTravel`: they all get the same
press, and the innermost is the one the hand is pointing at. So it takes the
gesture on the axis it walks, and the boxes above it are left with whatever axis
it does not — a row swiped sideways inside a column of screens keeps the
sideways gesture, and the column still answers a finger going down. Nothing has
to be declared for this: each box says which axes it travels in the DOM
(`data-travel-by-drag`, `data-travel-by-wheel`), and that is what the boxes above
read.

Decided at the press, once and for all: from the first pixel the gesture belongs
to whoever asked the browser for the pointer last, which is the outermost box.
So an inner box sitting on its last slide does not hand the gesture over
mid-drag: it leans on its wall, the way it does when it is alone. Travelling the
box around it means starting the gesture outside it.

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

What still leaks, only on Blink (Chrome, Edge), and only under a box that is not
a scroll container — a `SlideContainer` (it cuts with `overflow: clip`), a
`RouteTravel`, a swiped row: a scroller **nobody declared and no tag names** — a
bare `<div style="overflow: auto">`, a widget from elsewhere. Its leftovers
reach the page. Two ways out, per case: give the scroller a `Box` with an
`overflow` (it is then declared), or contain it by hand
(`overscroll-behavior-x: contain` under a box travelling sideways). The general
fix belongs to Blink.

## The two consumers that travel between screens

A popup pushed back towards its edge and a swiped row are travels too, the
simple kind: one box, one direction, no neighbour to bring in. The two below
carry screens.

|                         | `SlideContainer`                    | `RouteTravel`                      |
| ----------------------- | ----------------------------------- | ---------------------------------- |
| what the screens are    | `<Slide>`s in one box, all mounted  | routes — one mounted, ever         |
| what says which is here | a `signal`, `current` / a command   | the URL                            |
| what the finger moves   | a translated track                  | the pictures of a view transition  |
| letting go too early    | the track comes back                | the transition is played backwards |
| what says the order     | the layout map                      | the `<Route>` children, in order   |
| what one wheel push is  | `move(±1)`, as an arrow key         | one travel, as a tab pressed       |

Both expose how far the travel has come, and the way to read it differs because
what draws an indicator differs. `SlideContainer` writes
`--slide-travel-progress` — where the picture stands against the current slide,
in boxes: 0 on it, +1 a whole box before it, -1 one after — on its box, for
anything drawn inside it, and on every element marked
`data-slide-container-follows={id}` outside it (a tab bar above the box). It is
declared with `@property`, so it interpolates. `RouteTravel` leaves it to the
browser: give the indicator a `view-transition-name` of its own and it is
animated from where it was to where it is, even from outside the box (see
[view_transitions.md](./view_transitions.md#a-name-is-unique-per-document)).

A travel is not a queue: a tab pressed while a page is arriving does not wait
its turn, and does not start a second travel on top of the first either. The
travel in flight is aimed there instead. Back where it set off from, it is
undone — the same pictures, run backwards; further the same way, it costs
nothing; the other way, the pictures start again from the beginning, and a page
nearly arrived snaps back first.

A hand that walks a `RouteTravel` page whole and keeps going gets the next page,
but out of the far end there is a short gap: the page it was leaving is gone,
the next travel needs pictures of its own (a navigation, a render, a snapshot),
and over those frames nothing follows the finger before catching up with it.
Walked back out of the start there is none — the pair in hand is already the
right one. A `SlideContainer` has every slide mounted and hands over without a
gap either way.

### One gesture that bar cannot follow

A `RouteTravel` travel that turns around mid-gesture, or is aimed further the
same way while it plays — a tab pressed two pages along, the next swipe landing
on a page still arriving — keeps its pages by pointing the router elsewhere
under the same transition. But everything ELSE the transition carries was
photographed when it began, on its way to a tab nobody is going to anymore, and
the thing itself has already moved on in the live page: one would see two bars.

So on those gestures the pictures of everything that is not the pages are
dropped, and those things are left where they are, live: the bar jumps to the
tab one is heading for instead of sliding to a tab one is not. A slide would be
nicer, and it is not available — the browser measured both of its ends before
the hand changed its mind, and neither can be asked for again.
