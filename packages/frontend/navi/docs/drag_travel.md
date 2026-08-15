# Travelling by drag, and who owns the gesture

A drag-travel is a pointer pushing a whole screen aside to bring in the next
one: slides inside a box (`SlideContainer`), pages that are URLs
(`RouteTravel`). One module answers what such a gesture IS —
[src/layout/drag_travel.js](../src/layout/drag_travel.js) — and both read it, so
a hand never has to learn two sets of numbers.

## What the rules are

- A press is not a gesture until it has wandered ~10px, and the axis it leans on
  then is the axis it walks, for good. A diagonal would ask for two travels at
  once and only one screen can arrive.
- Letting go carries on when about a third of a box has been pulled, or on a
  flick, whatever the distance — a gesture that has clearly begun is an
  intention, and asking for a screen to be dragged all the way across turns a
  travel into work.
- Pulling towards nothing follows the finger at a fraction of its distance and
  comes back: a wall one can lean on, never walk through.

## Who owns a gesture

Two things can claim a pointer that landed on a travelling box, and both are
read before the box moves:

1. **What says so itself.** A field, a `contenteditable`, or anything carrying
   `data-no-drag-travel`.
2. **A scroller in between with room left that way.** It keeps the gesture until
   it has no room left, and only then hands the travel over — so a row that
   scrolls sideways inside a page still scrolls sideways.

### A navi component that reads the pointer marks ITSELF

`data-no-drag-travel` is written by the component that takes the pointer, never
by whoever puts it in a page:

```jsx
<div className="navi_wheel_viewport" data-no-drag-travel="">
```

The caller cannot know — a `Table` whose columns can be dragged, a `Wheel` spun
with a thumb, a canvas one draws on all look like ordinary content from
outside — and will not find out until they watch a page leave under their
finger. The component knows, so the component says it.

_Currently marked: the wheel viewport, the table resize handles, the cells of a
table whose columns can be dragged._

## The two consumers

|                         | `SlideContainer`                   | `RouteTravel`                      |
| ----------------------- | ---------------------------------- | ---------------------------------- |
| what the screens are    | `<Slide>`s in one box, all mounted | routes — one mounted, ever         |
| what says which is here | `current` / a command              | the URL                            |
| what the finger moves   | a translated track                 | the pictures of a view transition  |
| letting go too early    | the track comes back               | the transition is played backwards |
| what says the order     | the layout map                     | the `<Route>` children, in order   |

Both expose how far the travel has come, and the way to read it differs because
what draws an indicator differs: `SlideContainer` writes
`--slide-travel-progress` on its box (a number, declared with `@property`, so it
interpolates) for anything drawn inside it; `RouteTravel` leaves it to the
browser — give the indicator a `view-transition-name` of its own and it is
animated from where it was to where it is, even from outside the box.
