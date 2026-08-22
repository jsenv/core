# Route transitions

How pages of an app move against each other when the user navigates —
`defineRouteTransition`, `defineRouteDefaultTransition`, and the thinking that
decides which movement (if any) a navigation deserves. The API grammar itself
(accepted forms, shipped type names) lives in the JSDoc of
`defineRouteTransition`; this file holds what a signature cannot say.

Demos: [the movements](../src/nav/demos/route_transition/route_transition.html),
[a default transition](../src/nav/demos/route_transition/route_transition_default.html),
[pages between fixed bars](../src/nav/demos/route_transition_fixed_bars/route_transition_fixed_bars.html),
[with a RouteTravel inside](../src/nav/demos/route_transition/route_transition_with_travel.html)

## What a transition is for

A transition is not decoration: it states a **relation** between two pages, and
the user reads it as a map. A page sliding in from the right says "this place is
deeper, the way back is to the left" — which is why the back arrow then feels
inevitable rather than learned. A movement that states a relation the app does
not actually have (a slide between two sibling tabs) teaches a false map, and a
false map is worse than no animation at all.

So the unit of declaration is the pair, not the app:

```js
defineRouteTransition(MY_GAMES_PAGE, GAME_PAGE, "slide-x");
defineRouteTransition(RADAR_PAGE, GAME_PAGE, "slide-x");
```

and two pages never written in the same relation play **nothing** between each
other. That silence is a statement too: "Mes parties" and "Radars" are two tabs
of a bottom bar, side by side, neither before the other — a cut is the honest
rendering of that fact. Resist the urge to fill every navigation with movement;
declare the relations that exist and let the rest cut.

## Choosing a movement

- **`slide-x`** — going INTO something: a list item opened, a card followed, a
  notification tapped. The page is deeper on the same plane; leaving it slides
  back out. The most common relation in an app, and the one every phone has
  taught.
- **`slide-y`** — the same relation on a vertical arrangement, when the layout
  genuinely reads as a column.
- **`cover-x` / `cover-y`** — a page that INTERRUPTS rather than continues:
  settings, a composer, anything modal-like that one returns from to find the
  page beneath unchanged. The covered page holding still is the point — it
  promises "you are not leaving, this is on top".
- **`zoom`** — a detail brought closer: a photo, a card expanded into a page.
- **`cross-fade`** — a soft change with no spatial claim. Use it where a cut
  feels harsh but no direction would be true.
- **`none`** — silence, written down. Needed only to override: one way of a
  pair, or the default.

Two recommendations that matter more than the individual choices:

- **One movement per KIND of relation, app-wide.** If opening a game slides
  from the right, opening a profile should too — the user learns one grammar,
  not one rule per page.
- **Keep reciprocity.** The way back being the same movement reversed is what
  makes the map hold together; it is the default, and breaking it (a relation
  written for the exact way travelled wins over being the reverse of another)
  should answer a real asymmetry in the app, not a styling whim.

## A default transition — when

`defineRouteDefaultTransition("cross-fade")` plays on every navigation no
relation was written for. Two situations, two answers:

- **App-shaped UI** (bars, tabs, pages one goes into): don't. The silence
  between sibling tabs is part of the grammar, and a default erases it. Declare
  the relations by hand.
- **Content-shaped site** (documents, articles, browsing): a global cross-fade
  can be right — every navigation is a soft change of subject and no pair
  deserves a direction. This is the case the export exists for.

A default has no direction (nothing says which of two arbitrary pages is
"before" the other), so only directionless movements make sense there. Written
relations, and `"none"`, always win over it.

## Pages between fixed bars: the transition area

By default the movement plays on the document itself — right when pages are the
whole viewport. With fixed bars it is not: the root snapshot spans the viewport
and the bars' regions are blank in it, so the moving picture drags a blank band
across the screen where they stand. Wrap the pages instead:

```jsx
<RouteTransitionArea className="app">
  <Route>…</Route>
</RouteTransitionArea>
```

The movement then plays on that region's own pictures, and the bars never move
— without being named one by one. An app with fixed bars should consider this
part of declaring transitions at all, not an option.

The pages are cut twice: at the area's own bounds, and at the app's **safe
area** (see [safe_area.md](./safe_area.md)). The second cut is not a detail. A
fixed bar is fixed to the window while the area is a long box in the document —
the room the bar gives back is padding, so the content runs under it by design.
The pictures are drawn in the top layer, above everything the document can
clip, so without that cut a page taller than the screen, or a scrolled one,
would be watched sliding over the bars for the whole movement. The band is read
from the safe area rather than from the bars, so every kind of furniture is
covered at once and one that unmounts mid-movement is followed without anything
being told.

For the same reason, how far a page travels is the **window** it is seen
through, not the page's own size: a page is as tall as its content, and a
vertical movement measured on the picture would send it several screens away —
off screen for most of the transition, flying past at the end.

A page that was **scrolled** is photographed where the reader was, and travels
from there: the document is not put back to its top until the picture has been
taken. Without that wait the picture keeps only the band the browser had
already painted at the new offset, and the movement carries a fragment of the
page instead of the page.

With an area marked, the page around it is left LIVE rather than photographed:
the bars keep answering the pointer for the whole movement, which a captured
element cannot do. The flip side is that anything around the area which must
_animate_ rather than stand still — a title that changes with the route — needs
a `view-transition-name` of its own; named, the browser moves it on the same
clock as the pages.

It is a `Box`, so the layout the pages need is written on it directly (`flex`,
`className`, `style`, …). An app that already has an element holding its pages
can mark that one with `data-navi-route-transition-area` rather than nesting
another — the component does exactly that.

**The area is a real box, and it has to be**: what gets photographed and
clipped IS its rectangle. So `display: contents` cannot be used on it — an
element with no box is never captured, and the movement then plays on nothing
(the browser also aborts the transition). This is measured behaviour, not a
precaution.

Three misconfigurations are silent enough to be worth a console warning, each
said once: an area that was not captured (the case above), several elements
marked at once (they would share one `view-transition-name`, and the browser
then refuses **every** view transition of the document), and pages travelling
on the document while something else is captured on its own — the blank band.
A warning here is a bug to fix, not a mechanism to lean on.

## Custom movements

A type navi does not ship belongs to the application: the name is written on
the root for the length of the transition
(`data-navi-route-transition-type="<type>"`, next to
`data-navi-route-transition="forward"|"back"`), and the app's CSS defines the
movement against the view transition pseudo-elements — of the document, or of
the marked area. See the JSDoc of `defineRouteTransition` for the selector
shape, and the `spin` type in the demo for a working one.

## Route transitions and `RouteTravel` — one pair, one system

`RouteTravel` and `defineRouteTransition` answer different questions:

- **`RouteTravel`** is a ROW: a total order of tabs, plus the drag gesture that
  walks it. Use it when the pages are genuinely a row the finger should push.
- **`defineRouteTransition`** declares individual relations, with no gesture
  and no order beyond each pair.

A given PAIR of routes must be animated by one of the two, never both: a
travel's pictures can be under a finger, and a transition starting on top would
skip them mid-slide — and a page one can drag has promised a translation, which
a cross-fade would break. The runtime enforces the priority (a travel in flight
wins; the route transition is skipped with a console warning); the warning is
the sign of a misconfiguration to fix, not a mechanism to rely on.

The two DO live together in one app, on different pairs, including a
`<RouteTravel>` nested inside a `<RouteTransitionArea>` — a row of sections the
thumb pushes, inside pages one goes into. Write the relations on the routes the
row does not own: the tabs of the row travel, and opening something from any of
them plays its own movement. A relation written on a bare route covers every
one of its params at once, which is what makes "from any section" one line
rather than one per tab. Demo:
[../src/nav/demos/route_transition/route_transition_with_travel.html](../src/nav/demos/route_transition/route_transition_with_travel.html)

One trap that belongs to `RouteTravel` rather than to transitions, but bites
here first: the travelling box must stay MOUNTED across the changes it
animates. A `<RouteTravel>` rendered inside the `element` of each of the routes
it travels between is destroyed mid-travel by the router. Give the row a single
branch — its tabs as params of one route is the usual shape.

## The rest, briefly

- Pace: `--navi-route-transition-duration` (CSS, default 300ms) for everyone;
  a per-relation `{ type, duration }` for one relation.
- The URL leads: transitions play on navigations somebody else started (a
  `<Link>`, the back button, `history.back()`). Nothing here navigates.
- A browser without view transitions (Firefox) navigates with a cut. The app
  must remain fully usable that way — which it is, if the transitions state
  relations rather than carry information.
