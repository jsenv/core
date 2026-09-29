# Route transitions

How pages of an app move against each other when the user navigates —
`defineRouteTransition`, `defineRouteDefaultTransition`, what one link or one
`navTo` may ask for on top of them, and the thinking that decides which movement
(if any) a navigation deserves. The API grammar itself (accepted forms, shipped
type names) lives in the JSDoc of `defineRouteTransition`; this file holds what a
signature cannot say.

Demos, in `src/nav/demos/`: `route_transition/route_transition.html` (the
movements), `route_transition/route_transition_default.html` (a default
transition), `route_transition_fixed_bars/route_transition_fixed_bars.html`
(pages between fixed bars), `route_transition/route_transition_with_travel.html`
(with a `RouteTravel` inside).

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
- [The page being left stays until its movement is over](#the-page-being-left-stays-until-its-movement-is-over)
- [Waiting for a navigation: the address is not the page](#waiting-for-a-navigation-the-address-is-not-the-page)
- [What a transition costs](#what-a-transition-costs)
- [The rest, briefly](#the-rest-briefly)

## What a transition is for

A transition is not decoration: it states a **relation** between two pages, and
the user reads it as a map — a page sliding in from the right says "this place is
deeper, the way back is to the left", which is why the back arrow then feels
inevitable rather than learned. A movement stating a relation the app does not
have (a slide between two sibling tabs) teaches a false map, and a false map is
worse than no animation at all. So the unit of declaration is the pair, not the
app:

```js
defineRouteTransition(MY_GAMES_PAGE, GAME_PAGE, "slide-x");
defineRouteTransition(RADAR_PAGE, GAME_PAGE, "slide-x");
```

and two pages never written in the same relation play **nothing** between each
other. That silence is a statement too: "Mes parties" and "Radars" are two tabs of
a bottom bar, side by side, neither before the other — a cut is the honest
rendering of that fact. Declare the relations that exist and let the rest cut.

## A page opened from anywhere

One shape of page has no pair to write: its door is in the fixed furniture — a
gear in the top bar, a "+" in the tab bar — so it is opened from every screen and
closed back onto whichever one the reader was on. Leave the `from` out:

```js
defineRouteTransition(null, SETTINGS_PAGE, "cover-top");
```

Arriving there plays forward from wherever, leaving plays back to wherever. It is
tried last — a pair naming the same destination still owns its crossing — and it
is not `defineRouteDefaultTransition`, which is about every navigation nothing
was said about. Write it only for a door that really is furniture: a page reached from a
screen has that screen to be paired with, and the pair says more.

**Such a page is still a PAGE**: it takes the screen's place, and the reader comes
back to whatever the router puts there. A destination that must be drawn OVER the
screen and give it back exactly on closing is a layer, not a page — its address
says so differently, and no relation is written for it (see
[navigation.md](./navigation.md#a-layer-over-the-screen-what-its-address-may-say)).

## Choosing a movement

- **`slide-x`** — going INTO something: a list item opened, a card followed, a
  notification tapped. The page is deeper on the same plane; leaving it slides
  back out. The most common relation in an app.
- **`slide-y`** — the same relation on a vertical arrangement, when the layout
  genuinely reads as a column.
- **`cover-right` / `cover-left` / `cover-bottom` / `cover-top`** — a page that
  INTERRUPTS rather than continues: settings, a composer, anything modal-like that
  one returns from to find the page beneath unchanged — the covered page holding
  still says "you are not leaving, this is on top". The edge named is the one the
  page comes IN from, and the one to name is where its door is: a composer opened
  from a bottom bar covers from the bottom.
- **`zoom`** — a detail brought closer: a photo, a card expanded into a page.
- **`cross-fade`** — a soft change with no spatial claim, where a cut feels harsh
  but no direction would be true.
- **`none`** — silence, written down. Needed only to override: one way of a pair,
  or the default.

Two recommendations that matter more than the individual choices:

- **One movement per KIND of relation, app-wide.** If opening a game slides from
  the right, opening a profile should too — the user learns one grammar, not one
  rule per page.
- **Keep reciprocity.** The way back being the same movement reversed is what
  makes the map hold together. It is the default, and breaking it (a relation
  written for the exact way travelled wins over being the reverse of another)
  should answer a real asymmetry, not a styling whim: write the way back only to
  say something DIFFERENT — another movement, or `"none"`. Written with the same
  one, both crossings play forward and the pair can never say "back" again, the
  back button included; navi warns when it sees that pair.

## A default transition — when

`defineRouteDefaultTransition("cross-fade")` plays on every navigation no relation
was written for. Two situations, two answers:

- **App-shaped UI** (bars, tabs, pages one goes into): don't. The silence between
  sibling tabs is part of the grammar, and a default erases it.
- **Content-shaped site** (documents, articles, browsing): a global cross-fade can
  be right — every navigation is a soft change of subject. This is the case the
  export exists for.

A default has no direction (nothing says which of two arbitrary pages is
"before" the other), so navi's `slide-*` and `cover-*`, written on the direction,
play nothing there. Written relations, and `"none"`, always win over it.

## When one navigation knows better

A relation is written on a PAIR, so it holds for every way of reaching the page —
and some ways are walked against the map: a player's name tapped from a game is
the common way into a profile, a badge on that profile leading back to the game
it was won in is the rare one, and plays backwards. `"none"` cannot fix it: a
relation written for a way holds for every crossing of it, the back button's
included. So the navigation itself may ask, and what it asks holds for **that
navigation and no other**:

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
navTo(GAME_ROUTE.buildUrl({ id }), { routeTransition: { direction: "back" } });
GAME_ROUTE.navTo({ id }, { routeTransition: { direction: "back" } });
```

The request takes the forms `defineRouteTransition` takes, plus `direction`, and
overrides **field by field** — what it does not name, the relation (or the
default) still answers for:

- `{ direction: "back" }` keeps the pair's movement and only turns it round;
- `"zoom"` swaps the movement; the way round and the pace are still the pair's;
- `"none"` cuts, where the pair — or the default — would have played;
- `{ duration: 500 }` re-times what was already going to play.

A pair no relation was written for answers the same way: a link asking for a
movement gets it, forward unless it says otherwise. Navigate again by any other
means and the relations are back in charge — except the history traversal undoing
that navigation, which plays what it asked for, reversed (next section). The link
wears its request as an attribute, so a plain `<a>` says it too:
`data-navi-route-transition-request` holds a type name, or the object as JSON
(`'{"direction":"back"}'`).

## A traversal retraces its crossing

The back button, `navBack()`, `history.back()`, the browser's "next": a traversal
is not a walk on the map, it undoes one (or redoes one). The entry a push creates
remembers the crossing that created it — what played, which way, from which url
— so a back onto the page that crossing came from plays it reversed, and a
forward plays it again as it was.

That replay outranks everything the relations **deduce**, and nothing the author
**wrote** for that exact way:

| back from B to A                                | plays                         |
| ----------------------------------------------- | ----------------------------- |
| nothing written for `B → A`                     | the way in, reversed          |
| `B → A` written from anywhere (`null → …`)      | the way in, reversed          |
| `B → A` covered by a default transition         | the way in, reversed          |
| the way in asked for by a link (`direction: …`) | what the link asked, reversed |
| `defineRouteTransition(B, A, "none")`           | nothing                       |
| `defineRouteTransition(B, A, "flip")`           | flip, forward                 |

The line is drawn there because writing the way back by hand is the one tool for
breaking reciprocity, so it must reach the back button: a `"none"` written for
`B → A` silences every return from B to A, whatever pressed it. Everything else
is a deduction from a sentence about something else, and a traversal that knows
the crossing it undoes knows better. So a link walking the map the other way from
a page reached from anywhere (the author of a place's sheet, from the place) says
`routeTransition={{ direction: "forward" }}`, and the back undoes exactly that —
no reverse pair to write, none to collide with the other pages reaching the
place.

The relations alone answer a traversal that retraces no remembered crossing:
several entries at once, or an entry another document wrote. A link to the page
one just came from is a traversal too, where the browser exposes its stack (see
[navigation.md](./navigation.md#where-a-navigation-lands-the-scroll)).

## Pages between fixed bars: the transition area

By default the movement plays on the document itself — right when pages are the
whole viewport. With fixed bars it is not: the root picture spans the viewport and
the bars' regions are blank in it, so the moving picture drags a blank band across
the screen where they stand. Wrap the pages instead:

```jsx
<RouteTransitionArea className="app">
  <Route>…</Route>
</RouteTransitionArea>
```

The movement then plays on that region's own pictures, and the bars never move —
without being named one by one. For an app with fixed bars this is part of
declaring transitions at all, not an option. It is a `Box`, so the layout the
pages need is written on it directly; an app that already has an element holding
its pages marks that one with `data-navi-route-transition-area` instead.

The pictures are drawn in the top layer, above everything the document can clip,
so they are cut: at the area's own bounds, at the app's rectangle (the glass
beside an app narrowed with `--navi-app-max-width`), and at the bands the
furniture keeps free — the area runs under the fixed bars by design, and uncut, a
page taller than the screen would be watched sliding over them. The bands are
read, never declared, so furniture that grows, shrinks or unmounts mid-movement
is followed: the app's **safe area** ([safe_area.md](./safe_area.md)) for
everything pinned to the window's edges, and **`useTransitionCover(ref, edge)`**
for what covers the pages from INSIDE the document, which the safe area does not
count — a sticky row of tabs above them, a header pinned to the top of a scroller
(`edge` is `"top"` by default). The pictures of a route transition or a travel
are then cut at that element instead of sliding over it.

A page travels the **window** it is seen through, not its own height, and a page
that was **scrolled** is photographed, and travels, from where the reader was.

Each **fixed bar around the area is photographed on its own**, and whether it is
the frame or part of what changes is derived from the pair of states: a bar
**both states have** holds where it stands while the pages move behind it (a bar
whose content changes with the route cross-fades, unnamed); a bar **one state
has** travels with the page that has it, by the keyframes that page leaves or
arrives by, instead of appearing or vanishing in a frame — a full-screen wizard
whose banner is its own header. Every bar stands over the pages, as at rest, so
what it paints outside its box (a button standing up out of a tab bar, a shadow)
is seen for the length of the movement — except over a page **covered** by the
other one (`cover-*`): the sheet comes over that page's furniture too, so its bars
go under the pages, and what they paint outside their box is cut by their page for
those few hundred milliseconds.

A bar the application names itself keeps its name and its own keyframes — navi
names only what is unnamed — but plays on the movement's clock, under the pages.
Its name must be worn before the movement starts: navi reads it before its
attributes go on the root, so a name written only under
`:root[data-navi-route-transition]` is not seen, and one of navi's takes its
place.

Everything photographed goes deaf to the pointer for the length of the movement
(see
[view_transitions.md](./view_transitions.md#an-element-captured-in-a-view-transition-cannot-be-pointed-at)),
which is what the pages want: a press on a picture would be an accident. The
**door** in a bar the two states share is the exception — it stands where its
picture is drawn, and the press that closes the page it is still opening is aimed
at what the reader sees. `pressableDuringRouteTransition` on its `<Link>` or
`<Button>` (`data-navi-route-transition-pressable` on anything else) keeps it
answering: the click is caught at the document and handed to it when it fell
inside its rectangle, and a navigation that is the exact way back of the movement
playing turns that movement round. Only on furniture that stands still: a control
travelling with the pages has a rectangle where it will be, not where it is seen
(navi warns about one inside the area). `RouteTravel` is the opposite case — a
finger is on the box — and leaves the bars live.

A **modal `Dialog` open on a page** is furniture of the same kind: it travels with
its page, or holds if both states have it. Its wall cannot be photographed (see
[view_transitions.md](./view_transitions.md#the-top-layer-is-painted-through-the-roots-picture)),
and dropping it for the movement makes the window blink under the press, so navi
paints it into the pictures: a page leaving from under a wall leaves dimmed, one
arriving under a wall arrives dimmed, a wall both states have holds — and no frame
shows two walls. Demo:
`src/nav/demos/route_transition_dialog/route_transition_dialog.html`.

**The area is a real box, and it has to be**: what gets photographed and clipped
IS its rectangle. An element with `display: contents` is never captured, and the
movement then plays on nothing.

Four misconfigurations are silent enough to be worth a console warning, each said
once: an area that was not captured (the case above); several elements marked at
once — they share one `view-transition-name`, and the browser refuses every route
transition while they do; pages travelling on the document while something else
is captured on its own — the blank band; and, on a browser without nested groups,
a `view-transition-name` written inside the area, whose element escapes the pages'
picture (see
[view_transitions.md](./view_transitions.md#a-name-is-unique-per-document)). A
warning here is a bug to fix, not a mechanism to lean on.

## Custom movements

A type navi does not ship belongs to the application: the name is written on the
root for the length of the transition (`data-navi-route-transition-type="<type>"`,
next to `data-navi-route-transition="forward"|"back"`), and the app's CSS defines
the movement against the view transition pseudo-elements. Write it for both
groups, as navi does for its own: `root` when the document travels,
`navi-route-transition` when an area is marked — the root is then unnamed, and a
rule written for `(root)` alone never applies. The demo's `spin` type is one.

```css
:root[data-navi-route-transition-type="spin"][data-navi-route-transition="forward"] {
  &::view-transition-new(root),
  &::view-transition-new(navi-route-transition) {
    animation-name: spin-in;
  }
}
```

What is left to write is the `animation-name`s: navi gives ANY named type what
makes a movement look like one — each picture at the size it was taken at, two
solid pages rather than two panes of glass, the animation held where it ends. The
untyped cross-fade keeps the browser's defaults.

The one knob a custom movement may want back: a movement that animates ONE of its
two sides leaves the other on the browser's fade, and a fade needs its two
half-transparent pictures to add up rather than cover each other
(`mix-blend-mode: plus-lighter`, as the shipped `zoom` does). navi poses
`normal` from `:root[data-navi-route-transition][data-navi-route-transition-type]`,
in a sheet adopted after the document's own, so the rule taking it back must weigh
more than that selector
(`html:root[data-navi-route-transition][data-navi-route-transition-type="spin"]`
does); written on the type attribute alone, it is silently overruled.

A custom type can also say its two keyframes **as values** — what a fixed bar
belonging to one of the two states is given to travel with its page (a type that
publishes nothing leaves such a bar to the browser's fade) — and, when it plays
one page **over** the other, which one is covered: `old` when the page arriving
comes over the page being left, `new` when the page being left slides off the page
arriving. navi then draws the covered page under the other one, cut at its own
band, with its furniture under the pages, as the shipped `cover-*` types do:

```css
:root[data-navi-route-transition-type="spin"][data-navi-route-transition="forward"] {
  --navi-route-transition-leave: spin-out;
  --navi-route-transition-enter: spin-in;
}
:root[data-navi-route-transition-type="sheet"][data-navi-route-transition="forward"] {
  --navi-route-transition-covered: old; /* and "new" on the way back */
}
```

Those three values are read by navi from the root, so they are written there, and
navi registers them as not inherited: writing them costs nothing. Any other value
a custom movement's pictures read goes on `::view-transition`, never on the root
(see
[view_transitions.md](./view_transitions.md#what-makes-a-transition-restyle-the-whole-document)):

```css
:root[data-navi-route-transition-type="spin"] {
  &::view-transition {
    --spin-turns: 0.5;
  }
}
```

## Two routes matching one url

A relation is resolved through **which page is current** — not through the url,
and not through the branch the router renders. So a url claimed by two of the
routes named in relations makes the movement depend on the order the relations
were declared in:

```js
const ALERTS_ROUTE = route("/me/alerts");
const ALERT_CREATE_ROUTE = route("/me/alerts/create");
const ALERT_DETAIL_ROUTE = route("/me/alerts/:alertId"); // "create" is an alertId

defineRouteTransition(ALERTS_ROUTE, ALERT_DETAIL_ROUTE, "slide-x");
defineRouteTransition(ALERTS_ROUTE, ALERT_CREATE_ROUTE, "cover-bottom");
```

On `/me/alerts/create` both detail and create are current; the page mentioned
first wins, and the composer slides in from the right instead of covering.
Nothing on screen says so — a wrong movement is still a movement, and reads as a
deliberate choice. The fix is on the route, not on the relation: make one of them
decline the url (see
[navigation.md](./navigation.md#which-values-a-param-accepts)).

```js
const ALERT_DETAIL_ROUTE = route("/me/alerts/:alertId", {
  params: { alertId: (alertId) => alertId !== "create" },
});
```

Worth doing whether or not a transition is involved: two routes matching one url
also run two route actions, and compete for the branch the router renders (see
[navigation.md](./navigation.md#rendering-routes)). Left in place, navi says it
once in the console, naming both routes.

## Route transitions and `RouteTravel` — one pair, one system

- **`RouteTravel`** is a ROW: a total order of tabs, plus the drag gesture that
  walks it. Use it when the pages are genuinely a row the finger should push.
- **`defineRouteTransition`** declares individual relations, with no gesture and
  no order beyond each pair.

A given PAIR of routes must be animated by one of the two, never both: a travel's
pictures can be under a finger, and a transition starting on top would skip them
mid-slide — and a page one can drag has promised a translation, which a
cross-fade would break. A travel in flight wins and the route transition is
skipped with a console warning: the sign of a misconfiguration to fix, not a
mechanism to rely on.

The two DO live together in one app, on different pairs, including a
`<RouteTravel>` nested inside a `<RouteTransitionArea>` — a row of sections the
thumb pushes, inside pages one goes into. Write the relations on the routes the
row does not own: the tabs travel, and opening something from any of them plays
its own movement. A relation written on a bare route covers every one of its
params at once, so "from any section" is one line rather than one per tab. Demo:
`src/nav/demos/route_transition/route_transition_with_travel.html`.

One trap that belongs to `RouteTravel` but bites here first: the travelling box
must stay MOUNTED across the changes it animates. A `<RouteTravel>` rendered
inside the `element` of each of the routes it travels between is destroyed
mid-travel by the router. Give the row a single branch — its tabs as params of one
route is the usual shape.

## A transition says nothing about data

A relation is about the map of the app and nothing else: it does not change what
the page arriving loads, reloads or keeps. An action that `COMPLETED` still holds
its response, on the way back as on the way in — a page wanting fresh data says
`.rerun()`, with or without a movement — and a `<List.Items>` reading through
`GET_RANGE` still revalidates the window it draws when mounted again (see
[list_refresh.md](./list_refresh.md#who-decides-the-re-read--and-who-does-not)).
What a transition holds is the document's **rendering**, while the page being
left is photographed, and it gives it back in the same callback: nothing waits on
it, nothing is skipped because of it. The one thing that makes a revisit differ
under a movement is a back taken before the page being opened has rendered — see
[below](#waiting-for-a-navigation-the-address-is-not-the-page).

## The page being left stays until its movement is over

The picture of the page being left is taken before the change; the page arriving
is built inside the transition's update callback, and everything done there delays
the first frame of the movement. Taking a page down — every hook of every
component cleaned up — is a large part of it, and the page's picture already
exists, so it only has to stay out of the second one: a container that changes
page during the callback keeps the page it was showing, hidden (`display: none`),
and takes it down once the movement is over.

What that means for a page and for the application around it:

- **It is still mounted for the length of the movement.** Its effects keep
  running, and a component reading the URL, a route or a signal directly
  re-renders in it too, hidden. What it reads through `useAsyncData` does not:
  navi leaves a page alone as soon as its container would no longer show it.
- **It is taken down after the page arriving is up.** A cleanup that puts back
  what it found — a document title, a class on `<body>`, a value in a shared store
  — puts a stale value back over the new page's. Such a registration is written as
  "the last to arrive wins": navi's `<Head>` keeps its titles as a stack, and a
  slot shows the last `SlotFill` to arrive.
- **What it fills outside its own nodes leaves at once.** A `SlotFill` in a page
  kept while leaving steps out of its slot, so a bar each page fills shows the
  page arriving — or nothing, when that page fills none.
- **Its popups leave with it.** A popup it holds open is no longer rendered: it is
  photographed on the old side only, leaves with its page, and is closed when the
  page is taken down (see
  [view_transitions.md](./view_transitions.md#a-hidden-element-is-not-photographed-even-in-the-top-layer)).
- **The focus it holds goes where its removal would have sent it** — to no element
  — when it is hidden: a hidden element keeps the focus otherwise, and would
  receive the keys pressed during the movement.
- **Never while a modal dialog is open.** An open modal keeps everything but
  itself out of reach — the page arriving could not even take the focus — and one
  in a page kept while leaving would stay open for the whole movement. The page is
  then taken down at once, as without a movement.
- **Only where the page would have been taken down anyway.** A page rendered by
  the same element on both sides — two routes, one component — is the same
  instance carried over.

## Waiting for a navigation: the address is not the page

A navigation changes the URL first and the screen after — always. Under a
transition the gap is wider on purpose: the rendering hold spans the frame the
picture is taken in, so for that frame the address says one page and the screen
still shows the other. That is what makes the picture honest, and it is long
enough to be walked through by mistake. A test that waits on the URL has not
waited for anything to happen:

```js
// ✗ resolves while the page being left is still the page on screen
await page.getByTestId("game_card").click();
await page.waitForURL(/\/games\//);
await page.goBack();
```

That back does not come back from anywhere. Nothing was unmounted, so nothing
remounts — the list the user "returns to" is the element that never left, with no
first load, no revisit, and no re-read (see
[list_refresh.md](./list_refresh.md#who-decides-the-re-read--and-who-does-not)).
Wait for the page instead — anything only it can show:

```js
await page.getByTestId("game_card").click();
await expect(page.getByTestId("game_edit_link")).toBeVisible();
await page.goBack();
```

The window is **one frame**: no thumb moves in one frame, but an automated click
continues in the same millisecond. A testing trap, not a user-facing behaviour.

## What a transition costs

A transition adds one frame to a navigation: the browser photographs the page
being left at its next rendering opportunity, and the page arriving is built only
then, inside the update callback. Anything beyond that is avoidable:

- **Restyling the whole page being left in the frame it is photographed** — a
  `::highlight()` rule every element matches, or a custom property changed on the
  root as the movement starts (see
  [view_transitions.md](./view_transitions.md#what-makes-a-transition-restyle-the-whole-document)).
  navi's movements declare nothing inheritable on the root; a custom type writes
  its values on `::view-transition`.
- **The page being left reacting to what the navigation changed.** Every
  component in it that re-renders on the change does so inside the update
  callback, next to the page arriving being built. A `<Link route>` or
  `<Button route>` reads one flag — whether it is current — and stays still unless
  that flips; a row read with `RESOURCE.useById` follows that row only; and
  `useAsyncData` gives no render to a page its container no longer shows. A
  component reading an action's signals itself (`action.dataSignal.value`) gets
  none of that, and re-renders in the hidden page.
- **Restyling the page arriving more than once.** Built inside the update
  callback, it is styled as it lands; anything written afterwards that its
  elements inherit, or that re-selects them, restyles all of them again — the room
  a fixed bar takes (`--navi-fixed-bar-space-*`, feeding the inherited
  `--navi-safe-area-inset-*`) changing on the root as a bar arrives or leaves with
  the page, an app's `:has()` rule on the list container over its rows (an
  attribute the app sets on the container says the same thing for nothing).
- **Building rows the first picture does not show.** A list coming back where it
  was draws, in the update callback, only the rows that were on screen then (the
  `visibleCount` of the position it is handed back, see
  [scroll.md](./scroll.md#where-the-list-opens-and-where-it-is)), and the rest of
  its window once the movement has started — which plays on the compositor, and
  does not wait for them.
- **Re-rendering what did not change, on the press itself.** A component that only
  wants a yes or a no reads a computed flag, not the signal it is derived from.
- **Nothing is gained by starting at the press.** The picture can only be taken on
  the frame after the click; work moved to the pointer-down is paid again, for
  nothing, by every press that turns into a scroll.

## The rest, briefly

- Pace: `--navi-route-transition-duration` (CSS, default 300ms) for everyone; a
  per-relation `{ type, duration }` for one relation, worn by that movement's
  pictures only.
- The URL leads: transitions play on navigations somebody else started (a
  `<Link>`, the back button, `history.back()`). Nothing here navigates.
- A browser without view transitions navigates with a cut. The app must remain
  fully usable that way — which it is, if the transitions state relations rather
  than carry information.
