# Route transitions

How pages of an app move against each other when the user navigates —
`defineRouteTransition`, `defineRouteDefaultTransition`, what one link or one
`navTo` may ask for on top of them, and the thinking that decides which
movement (if any) a navigation deserves. The API grammar itself
(accepted forms, shipped type names) lives in the JSDoc of
`defineRouteTransition`; this file holds what a signature cannot say.

Demos: [the movements](../src/nav/demos/route_transition/route_transition.html),
[a default transition](../src/nav/demos/route_transition/route_transition_default.html),
[pages between fixed bars](../src/nav/demos/route_transition_fixed_bars/route_transition_fixed_bars.html),
[with a RouteTravel inside](../src/nav/demos/route_transition/route_transition_with_travel.html)

- [What a transition is for](#what-a-transition-is-for)
- [A page opened from anywhere](#a-page-opened-from-anywhere)
- [Choosing a movement](#choosing-a-movement)
- [A default transition — when](#a-default-transition--when)
- [When one navigation knows better](#when-one-navigation-knows-better)
- [A traversal retraces its crossing](#a-traversal-retraces-its-crossing)
- [Pages between fixed bars: the transition area](#pages-between-fixed-bars-the-transition-area)
- [Custom movements](#custom-movements)
- [Two routes matching one url](#two-routes-matching-one-url)
- [Route transitions and `RouteTravel` — one pair, one system](#route-transitions-and-routetravel--one-pair-one-system)
- [A transition says nothing about data](#a-transition-says-nothing-about-data)
- [Waiting for a navigation: the address is not the page](#waiting-for-a-navigation-the-address-is-not-the-page)
- [The rest, briefly](#the-rest-briefly)

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

## A page opened from anywhere

One shape of page has no pair to write. Its door is in the fixed furniture — a
gear in the top bar, a "+" in the tab bar — so it is opened from every screen of
the app and closed back onto whichever one the reader was on. The relation is
real and it is a single sentence ("the settings come down over the screen you
were on, and go back up"), but there are twenty-five `from` pages and not one of
them is the point.

Leave the `from` out:

```js
defineRouteTransition(null, SETTINGS_PAGE, "cover-top");
```

Arriving there plays forward from wherever, leaving plays back to wherever. A
back out of it retraces the crossing that opened it (see
[A traversal retraces its crossing](#a-traversal-retraces-its-crossing)); a link
out of it, to wherever, finds the relation the same way the way in did.

It is tried last, after every written pair, so a pair naming the same destination
still owns its crossing — the map, where it was drawn, is more precise than "from
wherever". And it is not `defineRouteDefaultTransition`: a default is about every
navigation nothing was said about, this is about ONE destination whose door
happens to be everywhere. Write it for a page whose door really is furniture; a
page reached from a screen has that screen to be paired with, and the pair says
more.

**Such a page is still a PAGE**, and that is the question to settle before
writing the relation: it takes the screen's place, and the reader comes back to
whatever the router puts there — not necessarily to what they were on. A door in
the furniture whose destination must be drawn OVER the screen, and must give it
back exactly on closing, is not a page at all: it is a layer, its address says so
differently, and no relation is written for it. See
[navigation.md](./navigation.md#a-layer-over-the-screen-what-its-address-may-say).

## Choosing a movement

- **`slide-x`** — going INTO something: a list item opened, a card followed, a
  notification tapped. The page is deeper on the same plane; leaving it slides
  back out. The most common relation in an app, and the one every phone has
  taught.
- **`slide-y`** — the same relation on a vertical arrangement, when the layout
  genuinely reads as a column.
- **`cover-right` / `cover-left` / `cover-bottom` / `cover-top`** — a page that
  INTERRUPTS rather than continues: settings, a composer, anything modal-like
  that one returns from to find the page beneath unchanged. The covered page
  holding still is the point — it promises "you are not leaving, this is on
  top". The edge named is the one the page comes IN from, and the one to name is
  where its door is: a composer opened from a bottom bar covers from the bottom,
  settings pulled down from a top bar cover from the top.
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
  should answer a real asymmetry in the app, not a styling whim. Write the way
  back only to say something DIFFERENT — another movement, or `"none"`. Written
  with the same one, both crossings find their own relation and both play
  forward, and the pair can never say "back" again, the back button included;
  navi warns when it sees that pair defined.

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
"before" the other), so only directionless movements make sense there: navi's
`slide-*` and `cover-*` are written on the direction, and as the default they
play nothing. Written relations, and `"none"`, always win over it.

## When one navigation knows better

A relation is written on a PAIR, so it holds for every way of reaching the
page — and some ways are walked against the map. Two pairs that are travelled
in both directions, with one direction common and one rare:

- a game ↔ a player's profile: the name of a player, tapped from the game, is
  the common way in; a badge on a profile that leads back to the game it was
  won in is the rare one;
- a profile ↔ the cards it describes: going down into the cards is the
  structural descent; a card that leads up to the player it describes goes back
  out.

Written for the common direction, the rare one plays backwards. And `"none"`
cannot fix it: a relation written for a way holds for every crossing of it,
the back button's included (see below), so silencing the bad direction
silences the good one too.

So the navigation itself may ask, and what it asks holds for **that navigation
and no other**:

```jsx
// The rare way round: the pair's movement, turned round.
<Link
  route={GAME_ROUTE}
  routeParams={{ id }}
  routeTransition={{ direction: "back" }}
>
  {badge.gameName}
</Link>
```

```js
// The same thing said by a call rather than by an element.
navTo(GAME_ROUTE.buildUrl({ id }), { routeTransition: { direction: "back" } });
GAME_ROUTE.navTo({ id }, { routeTransition: { direction: "back" } });
```

The request is `"slide-x"`-style shorthand or `{ type, duration, direction }`,
the same forms `defineRouteTransition` takes, plus `direction`. It overrides
**field by field**: what it does not name, the relation (or the default) still
answers for. So:

- `{ direction: "back" }` keeps the pair's movement and only turns it round;
- `"zoom"` swaps the movement; the way round and the pace are still the
  pair's;
- `"none"` cuts, where the pair — or the default — would have played;
- `{ duration: 500 }` re-times what was already going to play.

A pair no relation was ever written for answers the same way: silence is what
the routes say, and a link that asks for a movement gets it, forward unless it
says otherwise. That is the whole shape of the control:
`defineRouteTransition` is what the app's map says and applies by default; a
link, or a programmatic `navTo`, overrides it for the length of one navigation.
Navigate again by any other means and the relation is back in charge — with one
exception, which is what makes a request complete: a history traversal undoing
that navigation plays what it asked for, reversed (next section).

The link wears what it asks as an attribute, so a plain `<a>` says it too (a
type name, or the object as JSON):

```html
<a href="/game/42" data-navi-route-transition-request='{"direction":"back"}'
  >…</a
>
```

**Not yet: a movement chosen by HOW one navigated.** Playing one movement for
the back button and another for a link would be written on the same request —
`{ back: "slide-x", forward: "slide-y" }`. The notation is kept in mind for the
day it is asked for.

## A traversal retraces its crossing

The back button, `navBack()`, `history.back()`, the browser's "next": a
traversal is not a walk on the map, it undoes one (or redoes one). The entry a
push creates remembers the crossing that created it — what played, which way,
from which url — in its own state. A back onto the page that crossing came
from plays it reversed; a forward onto an entry whose crossing came from the
page being left plays it again as it was.

That replay outranks everything the relations **deduce**, and nothing the
author **wrote** for that exact way:

| back from B to A                                | plays                         |
| ----------------------------------------------- | ----------------------------- |
| nothing written for `B → A`                     | the way in, reversed          |
| `B → A` written from anywhere (`null → …`)      | the way in, reversed          |
| `B → A` covered by a default transition         | the way in, reversed          |
| the way in asked for by a link (`direction: …`) | what the link asked, reversed |
| `defineRouteTransition(B, A, "none")`           | nothing                       |
| `defineRouteTransition(B, A, "flip")`           | flip, forward                 |

The line is drawn there because the two halves answer two different needs.
Reciprocity is the default, and the one tool for breaking it is writing the
way back by hand — so that tool must reach the back button, which is the way
back most often taken: a `"none"` written for `B → A` silences every return
from B to A, whatever pressed it. Everything else `findRelation` answers is a
deduction from a sentence about something else (the reverse of a pair, a
destination reached from anywhere), and a traversal that knows the crossing it
undoes knows better than a deduction.

What this settles:

- a page reached from anywhere whose links walk the map the other way (the
  author of a place's sheet, from the place): the link says
  `routeTransition={{ direction: "forward" }}`, and the back undoes exactly
  that — there is no reverse pair to write, and none that would collide with
  the other pages reaching the place;
- a `routeTransition` request covers its own way back: a request is about one
  crossing, so nothing written for the pair outranks its replay;
- the "two ways of a pair" trade-off above is about pairs written in one
  direction: the reverse is deduced, and the traversal wins over it.

The relations alone answer a traversal that retraces no remembered crossing:
several entries at once, or an entry another document wrote. And a link to the
page one just came from is a traversal too where the browser exposes its stack
(navi turns such a push into a back, see `browser_integration/via_history.js`),
so it retraces as the button does — under the same rule.

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

With an area marked, each **fixed bar around it is photographed on its own** for
the length of the movement, and whether it is the frame or part of what changes
is derived rather than declared — it is a fact about the pair of states, not
about the bar:

- a bar **both states have** is one element, so its two pictures pair into one
  group and it holds where it stands. The pages move behind it, and a bar whose
  content changes with the route cross-fades without being named by hand.
- a bar **one state has** meets no counterpart. It belongs to the page that
  has it and travels with that page — leaving by the keyframes the page being
  left leaves by, arriving by the ones the page arriving arrives by — instead
  of appearing or vanishing in a frame. A page that takes the whole screen (a
  full-screen wizard whose banner is its own header) is this case, on the way
  in and on the way back.

Every bar stands over the pages, as it does at rest: the page runs under its
bar by design, and what a bar paints outside its box — a button standing up
out of a tab bar, a shadow on the page — is seen for the length of the
movement instead of being cut at the bar's edge. The one exception is a page
**covered** by the other one (a `cover-*` movement): the sheet must come over
that page's furniture too, so the bars of the covered page go under the pages
and the covered page is cut at its own band instead. What such a bar paints
outside its box is cut by its own page for those few hundred milliseconds — a
bar cannot be both over its own page and under the other one. The price of
being photographed is that a bar cannot answer the pointer for the length of
the movement, which is what a route transition wants anyway: both pages are
pictures too, and a press landing on either would be an accident. `RouteTravel`
is the opposite case — a finger is on the box — and leaves the bars live.

A bar the application names itself keeps its name and its own movement: navi
names only what is unnamed.

A **modal `Dialog` open on a page** is furniture of the same kind: its box is
photographed on its own and travels with its page, or holds where it stands if
both states have it. Its **wall** cannot be photographed (see
[view_transitions.md](./view_transitions.md#the-top-layer-is-painted-through-the-roots-picture)),
and dropping it for the movement makes the whole window blink under the press.
So the wall is painted where it would be seen: into the pages' picture, into
each bar's picture, and, for what no picture covers (the glass beside a
narrowed app, the window below a short page), as a live element under the
pictures that fades on the movement's clock. The outcome is derived from the
pair of states like everything else here — a page leaving from under a wall
leaves dimmed and the bars fade their dim with it; a page arriving under one
arrives dimmed and the bars dim with it; a wall both states have holds. The real
wall is switched off for exactly the length of the movement, so no frame shows
two walls. Demo: [a dialog leaving with its page](../src/nav/demos/route_transition_dialog/route_transition_dialog.html).

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

What is left to write is the `animation-name`s and nothing else: navi attaches
to ANY named type what makes a movement look like one — each picture at the
size it was taken at (a page half the height of the one it crosses would
otherwise be seen inflating over the length of the movement), two solid pages
rather than two panes of glass, and the animation held where it ends. The
untyped cross-fade keeps the browser's defaults, since scaling one picture into
the other is the whole idea there.

The one knob a custom movement may want back: a movement that animates ONE of
its two sides leaves the other on the browser's fade, and a fade needs its two
half-transparent pictures to add up rather than cover each other
(`mix-blend-mode: plus-lighter`, as the shipped `zoom` and the demo's `spin`
both do). A movement where both pages move wants what navi poses.

A custom type can also say its two keyframes **as values**, next to the rules
that play them:

```css
:root[data-navi-route-transition-type="spin"][data-navi-route-transition="forward"] {
  --navi-route-transition-leave: spin-out;
  --navi-route-transition-enter: spin-in;
}
```

That is what a fixed bar belonging to one of the two states is given to travel
with the page it belongs to (see the transition area above). Nothing else reads
them, and a type that publishes nothing leaves such a bar to the browser's fade.

A type that plays one page **over** the other says which one is covered, the
same way:

```css
:root[data-navi-route-transition-type="sheet"][data-navi-route-transition="forward"] {
  --navi-route-transition-covered: old;
}
:root[data-navi-route-transition-type="sheet"][data-navi-route-transition="back"] {
  --navi-route-transition-covered: new;
}
```

`old` says the page arriving comes over the page being left, `new` that the
page being left slides off the page arriving. Navi then draws the covered page
under the other one, cuts it at its own band, and puts its furniture under the
pages so the sheet comes over it (see the transition area above). The shipped
`cover-*` types say exactly this; a movement where neither page covers the
other publishes nothing.

## Two routes matching one url

A relation is written between two pages, and it is resolved through **which page
is current** — not through the url, and not through the branch the router
renders. So a url claimed by two of the routes named in relations makes the
movement depend on the order the relations were declared in:

```js
const ALERTS_ROUTE = route("/me/alerts");
const ALERT_CREATE_ROUTE = route("/me/alerts/create");
const ALERT_DETAIL_ROUTE = route("/me/alerts/:alertId"); // "create" is an alertId

defineRouteTransition(ALERTS_ROUTE, ALERT_DETAIL_ROUTE, "slide-x");
defineRouteTransition(ALERTS_ROUTE, ALERT_CREATE_ROUTE, "cover-bottom");
```

On `/me/alerts/create` both detail and create are current; the page mentioned
first wins, and the composer slides in from the right instead of covering. It is
the one place where declaration order is load-bearing, and nothing on screen says
so — a wrong movement is still a movement, and reads as a deliberate choice.

The fix is on the route, not on the relation: make one of them decline the url
(see [navigation.md](./navigation.md#which-values-a-param-accepts)).

```js
const ALERT_DETAIL_ROUTE = route("/me/alerts/:alertId", {
  params: { alertId: (alertId) => alertId !== "create" },
});
```

Which is worth doing whether or not a transition is involved: two routes matching
one url is also two route actions running, and two branches competing for the
`<Route>` the router renders. Left in place, navi says it once in the console,
naming both routes.

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

## A transition says nothing about data

A relation is about the map of the app, and about nothing else. Defining one
does not change what the page arriving loads, reloads, or keeps:

- an action that `COMPLETED` still holds its response, on the way back as on the
  way in — a page wanting fresh data says `.rerun()`, with or without a
  movement;
- a `<List.Items>` reading through `GET_RANGE` still revalidates the window it
  draws when it is mounted again.

What a transition takes is the document's **rendering** for the one frame the
browser needs to photograph the page being left (see `rendering_hold.js`), and
it gives it back in the same callback. The hold is about a picture, not about
data: nothing waits on it, nothing is skipped because of it.

That is the design, and it is held by `tests/route_transition_list_revisit/`:
one app mounted twice, the two mounts differing by a single
`defineRouteTransition` line, walked back and forth **ten times each** with what
goes to the network counted on every revisit. The loop is the point — a
difference that came and went would pass a single comparison often enough to
look like an invariant. Three decors, chosen to be opposites: a long list
virtualized against its scroller, the same one held on a row the url names, and
a one-row list against the document scroller with its count known from
elsewhere.

One thing does make a page lose its revisit under a movement and not without
one, and it is not about data either: a back taken before the page being opened
has rendered, which returns to a page that never left. It has its own section
below. See
[list_refresh.md](./list_refresh.md#who-decides-the-re-read--and-who-does-not)
for which source refreshes on a revisit and which does not.

## Waiting for a navigation: the address is not the page

A navigation changes the URL first and the screen after — always. Under a
transition the gap is wider on purpose: the rendering hold above spans the frame
the picture is taken in, so for that frame the address says one page and the
screen still shows the other. That is what makes the picture honest, and it is
also long enough to be walked through by mistake.

So a test that waits on the URL has not waited for anything to happen:

```js
// ✗ resolves while the page being left is still the page on screen
await page.getByTestId("game_card").click();
await page.waitForURL(/\/games\//);
await page.goBack();
```

That back does not come back from anywhere. Nothing was unmounted, so nothing
remounts — the list the user "returns to" is the element that never left, with
no first load, no revisit, and no re-read (see
[list_refresh.md](./list_refresh.md#who-decides-the-re-read--and-who-does-not)).
Every symptom of the arriving page being wrong follows from a walk that never
took place.

Wait for the page instead — anything only it can show:

```js
await page.getByTestId("game_card").click();
await expect(page.getByTestId("game_edit_link")).toBeVisible();
await page.goBack();
```

The window is **one frame**: the hold is given back inside the view
transition's callback, which the browser runs at its next rendering
opportunity. `tests/route_transition_list_revisit/` walks it the wrong way on
purpose in its last case — a back pressed the instant the URL changes — and
which side of that frame a cycle lands on belongs to the machine's load: under
a movement the list that comes back is either the element that never left,
asking for nothing, or one truly remounted, asking once, while the same walk
without a movement is a real one every time. No thumb moves in one frame; an
automated click continues in the same millisecond. This is a testing trap, not
a user-facing behaviour.

## The rest, briefly

- Pace: `--navi-route-transition-duration` (CSS, default 300ms) for everyone;
  a per-relation `{ type, duration }` for one relation.
- The URL leads: transitions play on navigations somebody else started (a
  `<Link>`, the back button, `history.back()`). Nothing here navigates.
- A browser without view transitions navigates with a cut. The app
  must remain fully usable that way — which it is, if the transitions state
  relations rather than carry information.
