# Scroll & layout

Where scrolling happens in a navi app, and how the pieces that live inside a
scrolling area (`Box header/body/footer`, `List`, a popup) are told about it.

Where a navigation LANDS is another subject — a push at the top, a push with a
`#id` on the element it names, a back or forward where the page was left, a row
of tabs giving each tab back the offset it was read at: see
[navigation.md](./navigation.md#where-a-navigation-lands-the-scroll).

- [What makes header/body/footer work: the overflow](#what-makes-headerbodyfooter-work-the-overflow)
- [1. The document scrolls](#1-the-document-scrolls)
- [2. A part of the document scrolls](#2-a-part-of-the-document-scrolls)
- [3. A popup scrolls](#3-a-popup-scrolls)
- [Many rows: `List.Items` and the render window](#many-rows-listitems-and-the-render-window)
- [Hover while scrolling](#hover-while-scrolling)
- [The list border](#the-list-border)

## What makes header/body/footer work: the overflow

`header`, `footer` and `body` are roles inside a scrolling area. What turns
them on is an `overflow: auto | scroll` on the box that contains them — there
is no second prop for the same fact.

```jsx
// header/body do NOTHING here: nothing scrolls
<Box flex="y">
  <Box header>…</Box>
  <Box body>…</Box>
</Box>

// here they do
<Box overflow="auto" maxHeight="60vh">
  <Box header>…</Box>   {/* stays put */}
  <Box body>…</Box>     {/* the only thing that scrolls */}
  <Box footer>…</Box>   {/* stays put */}
</Box>
```

`Dialog` and `Popover` get their own `header`/`body`/`footer` by that exact
same path: they ask `Box` for `overflow: auto` on themselves.

Two shapes, and they do not behave the same:

| what is inside            | behaviour                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header` / `footer` alone | the container itself scrolls, and they are `position: sticky` at its edges — the content scrolls under them                                                                                       |
| a `body` as well          | the container becomes a flex column, its own overflow turns to `hidden`, and the **body is the only thing that scrolls**; header and footer sit outside it (`position: static`, `flex-shrink: 0`) |

Before fighting them:

- the body is `flex: 0 1 auto` — **it shrinks, it never grows**. A short body
  leaves the footer right under it rather than pushed to the bottom of a box it
  does not fill. Adding `expandY` to "fix" that is undoing a deliberate default.
- the separating line is a `border-bottom` on the header (`border-top` on the
  footer), not a `box-shadow`: a shadow is drawn outside the box and lost to
  whatever is painted after it, so the body would cover the very line meant to
  separate them. Don't add a border of your own — you get two lines.
- a sticky header or footer (the shape without a body) is in the sticky
  z-index band, so everything the box contains passes under it, positioned or
  not; beside a body it is a plain block. What that costs and the way out are
  in [z_index.md](./z_index.md#a-sticky-part-is-only-in-the-band-while-it-is-stuck).

Padding belongs on the parts, not on the scrolling box: padding on a scroller
sits inside the scrollbars, and a control flush against the edge of a scrolling
area raises a scrollbar of its own (a focus outline is drawn outside the control
it belongs to).

The scrolling box — the body, when there is one — has
`scroll-padding: var(--navi-scroll-padding, var(--navi-s))`: what the browser
scrolls into view lands inside the area with room for its focus ring, rather
than flush on the edge where a footer or the edge of a popup half-swallows it.
`--navi-scroll-padding` changes that room.

Reference: `src/box/box.jsx` (the `[data-scrollable]` CSS),
`src/box/demos/8_scrollable_demo.html`,
`src/box/demos/9_scrollable_z_index_demo.html` (sticky parts and stacking).

## 1. The document scrolls

The default case: nothing to do, the document scrolls. What covers it — fixed
bars, the device's notch — is published as `--navi-safe-area-inset-*`, and the
container that scrolls under it says so with `data-navi-safe-area`: see
[safe_area.md](./safe_area.md#something-that-scrolls-under-the-furniture), and
[A document wider than the screen](./safe_area.md#a-document-wider-than-the-screen)
for the one way to turn that container into a scroller by accident.

A `List` in this case takes `scroller="document"` (in dev it warns when it finds
itself inside a scrollport anyway, and names the element).

## 2. A part of the document scrolls

A `Box` with an `overflow`, the shape at the top of this file. What needs
saying is a `List` inside it.

### `List` and its `scroller`

`List` has a `scroller` prop, and its default, `"self"` — a scroll box of the
list's own — is not the one most call sites want:

> If the list already lives in a box that scrolls (a dialog's `body`, a panel),
> it is `scroller="parent"`. `"self"` is for the list that IS the scrolling
> area, and it needs a height to scroll in (`maxHeight`, or `expandY` inside a
> bounded parent).

A `"self"` list inside a scrolling box nests a second scroller sized on its
own — and a virtualized run holds the room of every row it stands for, so the
popup or panel around it is sized on that rather than on the rows drawn.

`scroller` also names the box the render window follows (see
[Many rows](#many-rows-listitems-and-the-render-window)). A `"self"` list given
no height scrolls nothing; the window then follows whatever box does show the
list, and dev warns when nothing scrolls it at all — a recovery, not the shape
to aim for. When `"parent"` (found by measuring) is still not the box you mean,
say so with `"document"` or the element itself.

### Where the list opens, and where it is

`defaultScrolled` (or `scrolled`, held) takes `{id, offset}` — what
`onScrolledChange` hands out — and asks for the row BY NAME, then puts it back
by MEASURING it: it lands where it was even if rows were inserted before it,
whatever the screen it was saved on. "Reopen a thread where I left it" is
already provided; keep the position whole, its `visibleCount` sizes the first
paint. A `defaultScrolled` that changes before anyone has moved the list is
followed — a place read from an answer that refreshes (yesterday's "today", then
today's) — and it is compared by value, so it can be computed at every render. A list with an `id` also **comes back where it was** when its screen is
left and come back to, the way the page does (its `id` must name one list of the
app, see [below](#a-list-that-comes-back-one-id-one-list));
**`scrollResetOnNavigation`** opts out. A list scrolling the document that
opens on a row places the document itself: the offset the page kept for its url
is not put back over it — the rows held off screen are fillers of an estimated
height, and the same pixels now fall on other rows.

### A list that comes back: one `id`, one list

The position a list comes back to is kept under its `id` and the page's url, so
the `id` names **one list of the app**, not one list of the page. Two lists
mounted at the same time under the same `id` are one entry: each writes over the
other's position, and the one that goes takes the other's with it. The list
arriving then opens where the other one was, or comes back at its top after a
back.

Lists are mounted together more often than the screen shows:

- a list in a popup and a list in the page under it;
- a list in a bar or a sidebar kept by every page, and a list in one of the
  pages;
- the two pages of a **route transition**: the page being left stays mounted,
  hidden, until the movement is over (see
  [route_transitions.md](./route_transitions.md#the-page-being-left-stays-until-its-movement-is-over)),
  its lists with it.

So:

- **Name the list for what it lists** — `players_list`, `thread_messages`, never
  `list`, `results` or `items`.
- **A component that draws a list on several pages takes the `id` from the page
  using it** (a prop), rather than writing one of its own.
- **A list with no use for coming back** says `scrollResetOnNavigation`: it keeps
  nothing, and its `id` no longer matters for this.

Not a clash: a page rendered by the same element on both sides — one route whose
params change (`/threads/1` to `/threads/2`), two routes with one `element` — is
carried over, and its list is one list moving from one url to the next.

### A search moves the list, and gives it back

A list that is being searched has to move: the rows the user is after have just
been promoted to the top, and a view left where it was shows none of them. What
makes that possible is `searchText` on the `List` — without it the list sees new
children and nothing else.

- **While the search is on**, the list scrolls back to its first row every time
  the best matches change (as many top rows as the window draws, by id and
  `matchInfo.matchScore`), so a letter that promotes nobody new leaves the list
  where the user put it.
- **When the search is emptied**, the list returns to the offset it was at when
  the search started, render window included.

Both rest on each row knowing where it stands, which for rows declared one by
one is the order they are written in. Two things are needed for that, and the
list warns in dev when the second is missing:

- **a stable `key` on every row**, which is what says a row moved rather than a
  row changed;
- **the rows as the list's own children**. The places are read off the children
  the list is given, so a component of yours rendering the rows is one child
  however many rows come out of it — they all take the same place. Hand the
  list the rows, or a `<List.Items>`.

A row selected during the search does not hold the view: emptying the search
takes the list back to where it was, which may be nowhere near that row.

### Loading: two different situations

`loading` (with `loadingFallback`, `loadingSkeletonCount`, `renderSkeleton`)
says "I have nothing at all to show yet": placeholder rows stand in for the
whole list. `<List.Items count>` says "I know how many rows are coming": the
rows not held yet are skeletons in their own place, at their own size (see
[What the list knows, and what it guesses](#what-the-list-knows-and-what-it-guesses)),
asked for as they enter the render window — a list that knows its count has no
use for the first one.

Reference: `src/control/list/list.jsx` (JSDoc on `List` and `List.Items`).

## 3. A popup scrolls

### Structure

A popup does nothing special: it obtains `header`/`body`/`footer` the same way
everyone else does, by asking for the overflow — and it already asks, on itself.
So the parts are direct children of the `Dialog`:

```jsx
<Dialog id="…" dockedOnSmallTouchScreen>
  <Box header>title + close</Box>
  <Box body>
    <List scroller="parent" /> {/* NOT "self" */}
  </Box>
  <Box footer>…</Box>
</Dialog>
```

A dialog is already bounded by the room its container leaves it, so a
`maxHeight` is only for making it smaller than that (see
[dialog_shape.md](./dialog_shape.md#the-ceiling-nobody-sets)).

### `scrollCapture`

```jsx
<Dialog scrollCapture>
```

Traps wheel/touch gestures inside the popup so the page behind it cannot
scroll. **Without it, reaching the end of the content keeps going and the
screen underneath scrolls** — the sheet stays put while the content it covers
changes. It does not look like a scroll bug, and it is one. A dialog docked by
`dockedOnSmallTouchScreen` — the phone's sheet — has it by default (see
[dialog_shape.md](./dialog_shape.md#one-dialog-two-shapes)), so the prop above
matters for the other shapes. `Popover` has the same prop, plus `focusCapture`
for Tab.

### `SlideContainer` inside a popup

All slides live in **the same grid cell**, so the box measures itself on the
**largest** of them. That is what guarantees nothing resizes as one moves
between slides — and it also means a short slide shows empty room below it. It
is a trade, not a leak.

**The slide IS the body.** The shape everyone writes first gets it wrong: a
`Dialog` with a `<Box body>` around the slides puts a scroller ABOVE them, and
that scroller's content is the grid — measured on the tallest slide. Stand on a
short slide and it carries the scrollbar of a neighbour, scrolling through
emptiness.

```jsx
// WRONG — the dialog's body scrolls the tallest slide, on every slide
<Dialog maxHeight="min(80vh, 640px)">
  <Box header>tabs</Box>
  <Box body>
    <SlideContainer>
      <Slide padding="l">…</Slide>
    </SlideContainer>
  </Box>
</Dialog>

// RIGHT — the cap stays a constraint, each slide scrolls its own content
<Dialog maxHeight="min(80vh, 640px)" flex="y">
  <Box header flexShrink="0">tabs</Box>
  <SlideContainer>
    <Slide overflow="auto">
      <Box header padding="m">…</Box>  {/* the slide scrolls: padding on the parts */}
      <Box body padding="l">…</Box>
    </Slide>
  </SlideContainer>
</Dialog>
```

The cap on the height must reach the slides as a **constraint**, never as a
scroller: `SlideContainer` shrinks into what is left (`flex: 0 1 auto`; growing
is `expandY`), the grid hands that height to **every** slide, and a slide with
an `overflow` of its own scrolls only when ITS content is taller. So nothing
scrollable between the cap and the slides — a `<Box body>` around them is a
scroller, and so is a bare `overflow="auto"` on a wrapper. A shared `header`
takes an explicit `flexShrink="0"`: the rule that gives it for free applies
only next to a `body`.

**Padding goes on the slide** — or on its parts, since the slide is the
scroller — never on the container nor on anything above it. Overflow clips at
the _padding_ edge, so a padding on the container is a band the clipping does
not cover: the arriving slide is seen there before it has reached the frame.
And a padding above the slides does not travel — the two contents cross each
other flush, instead of each arriving already inset.

Pass `travelByKeyboard={false}` when the arrow keys belong to the content (a list
one walks through, a picker whose slides are steps): otherwise the right arrow
changes screen mid-reading.

Reference: `src/layout/slide_container.jsx`, and the "One slide much taller
than the others" case in `src/layout/demos/8_slide_container_demo.html`.

## Many rows: `List.Items` and the render window

What a list costs must not follow the size of its collection: the browser
paints nothing until the render that draws the rows has ended, so forty rows
given to a list that opens in a click are forty rows drawn before anything is
seen, for a screen that shows a dozen.

So the rule: **rows as `<List.Item>` children are all drawn**, and that is the
right shape only for a list the caller knows to be short — a menu, a settings
sheet, a handful of tabs. A collection whose size the caller does not decide
(users, messages, search results, anything read from a resource) goes to a run:

```jsx
// in memory: the whole collection, in order; the list draws a window of it
<List renderBudget={{ initial: 17, after: 30 }} virtualItemSize={45}>
  <List.Items items={users} renderItem={renderUser} />
</List>

// read a slice at a time: the run asks its source for what it is about to draw
<List>
  <List.Items itemsAction={USER.GET_RANGE.bindParams({ q })} renderItem={renderUser} />
</List>
```

The run draws only the items inside the **render window** — `renderBudget`,
`"100item"` by default — and holds the room of the others with fillers, so the
scrollbar says how long the collection is and the DOM says how many items fit a
screen and some. The window slides as the user scrolls, three quarters of what
the screen leaves of it ahead of the direction the user goes, so the budget has
to exceed what the scroller shows at once, with room for that lookahead: the
list warns when it holds no more than the screen. How much room is enough is
measured, not counted: the lookahead is the time the page has to draw the next
items before a fling reaches them, so it depends on the device and on what else
runs as the list scrolls — fling it on the slowest device it runs on.

The budget is a count of items or a size: `"300px"`, or `"150%"` of the
viewport of the box that scrolls the list. A size is for items that do not
weigh the same: a list mixing one-line items and full cards (a thread of past
games and games to come) holds ten times more of the first on a screen than of
the second. `"100item"` covers four screens of the one-line items and thirty of
the cards, and nobody scrolls to the thirtieth; a count right for the cards
leaves blank screens when a fling crosses the one-line items. With a size, the
window weighs the items it draws (see below).

A run whose rows all fit the window is just rows: nothing is virtualized, and
it costs what the same rows would as children. There is no reason to hold back
from it for a list that might grow.

What an item outside the window holds is not lost with its row: a selection
keeps the items it does not draw (`--navi-select` reaches them by id), and a
group keeps the keys of named controls that are not there
([control_object.md](./control_object.md#a-control-that-is-not-there)).

### What the list knows, and what it guesses

A virtualized list has one aim: draw as few items as it can, and never show a
blank where an item should be — with one simple rule, not a model of every kind
of item.

What is drawn, the list measures: the render window is sized on the room the
items it draws actually take, and an item that leaves the window is held at the
room it took — the window sliding changes nothing above the screen. What was
never drawn it cannot measure, so it guesses:

- the fillers hold every item never drawn at one size — `virtualItemSize` when
  given, the average of the items measured so far otherwise — unless its run
  says the room it takes (see below). A scroll position inside a filler is
  read with it too, and an item on its way takes at least that room;
- when the window reaches past what it has drawn, it weighs the next items like
  the drawn ones next to them, and measures them once they are drawn.

A guess is wrong one way or the other, and the two ways do not cost the same.
An item guessed **smaller** than it is makes the list count more items to fill
a space than it needs: it builds one or two more, and the screen is covered. An
item guessed **bigger** makes it count too few, and a blank shows until they
are measured. So a size you give is the **worst case**: in a list whose items
differ in height, `virtualItemSize` is the smallest an item can be — the
one-line item, in a thread of one-line items and cards. The scrollbar then
under-states a list made mostly of big items; the screen stays covered.

A guess costs something else when its item is drawn above the screen: the item
takes its real room, and what is on screen moves by the difference. The list
puts the screen back by writing the scroll, except where a write would cost the
user the scroll in progress — and on iOS a fling stops at any write, so during
a fling every card drawn above the screen pushes it down. A list that knows
the room of each item before the item arrives says it with `<List.Items
itemSize>`, and guesses nothing: the fillers hold every item at its own room.
That is a model to keep in step with the markup (in development, a drawn item
whose room differs from it is reported), worth it where the items above the
screen come in a few sizes the data tells apart before it arrives — the
one-line games and the compact cards of a thread, when the server says which
past games have a score.

The items on their way are held the same way: a skeleton stands where its item
will be, at the room it is drawn at, and when the page lands each item takes
its own room — what is below a skeleton of the wrong size moves by the
difference. The list puts the screen back while a real item is on it, but a
fling into a part of the collection not loaded yet leaves a screen of skeletons
alone, with no item to hold: the screen moves with every skeleton that was
wrong (hundreds of pixels, in a thread drawing one-line skeletons where compact
cards land). So `renderSkeleton` draws each index at the room its item will
take, from what is known before the data — the same knowledge `itemSize` gives
the fillers. Items that cannot be told apart before they arrive are better
drawn at one height than announced by skeletons that guess. And anything drawn
above the screen that changes size afterwards — an image without its
dimensions, a block that expands — moves the screen the same way, which nothing
puts back during a fling on iOS: reserve its room.

The window's own guess past what it has drawn is the one that is not the worst
case, on purpose. Guessing the smallest there walks into cards at the one-line
size and builds them several at a time — tasks of 50–65 ms while reading down
through cards, measured, for no blank spared. It guesses the neighbours' size
instead: items of one kind come together, and a window that comes up short is
measured and extended on the next frame.

### The first paint of a list that opens in a click

A popup's content is built in the click that opens it (see
[popup_open.md](./popup_open.md)), and a page coming back in a route transition
is built in the transition's update callback: rows below the fold cost the same
there as rows on screen, and delay the movement. `renderBudget` takes
`{ initial, after }` for exactly this: `initial` for the picture the browser
paints first, counted from the item the list opens on, and `after` from the
paint on. `initial: "100%"` is the screen and nothing more, whatever the items
weigh: a few are drawn to be measured, and the window is sized on them before
the browser paints — a count (`initial: 6`) is a guess that holds for one kind
of item only. A position handed back with its `visibleCount` sizes that first
window itself, whatever `initial` says. The runs ask their source for a page of
items (`<List.Items pageSize>`, 100 by default) whatever either says, so the
smaller first window costs no second request.

The switch waits for the paint itself. Do not rebuild it with a `useEffect`
that widens a slice: preact runs a component's pending effects early when that
component renders again, and something always re-renders before a popup has
painted.

### Cmd/Ctrl + F: `findText`

The browser's find in page searches the DOM, and a row outside the render
window is not in it: Cmd/Ctrl + F finds the rows on screen and a few around
them, nothing else.

```jsx
<List.Items
  items={users}
  renderItem={renderUser}
  findText={(user) => user.name}
/>
```

With `findText`, the fillers carry the text of the rows they stand for, inside
`hidden="until-found"` elements: on a match the browser scrolls there and the
render window, following that scroll like any other, draws the row. A row
inside the window has no hidden copy, so every row is found exactly once.

What it costs, and where it stops:

- **A cost that follows the collection again.** The text of every row outside
  the window is rebuilt when the window slides (one `findText` call per row)
  and sits in the DOM as text. Give it to a list a user would search with the
  browser, not to every run.
- **One line per row**, and only that line is found while the row is not
  drawn: return what a user would type, not everything the row shows.
- **What the client holds, no more.** A row a paginated run has not loaded has
  no text to be found by.
- **Chrome 102, Firefox 148, Safari 26.2.** Elsewhere the attribute reads as a
  plain `hidden`: find stops at the window, as without `findText`.

Two things not to write beside it:

- **A transparent copy of the list's text laid over it** (a `<textarea>`, a
  `<div>` in `color: transparent`): every row in the window is then found
  twice, and the copy only lines up with rows of one fixed height.
- **A `beforematch` listener moving the window**: the list re-renders after the
  event, which removes the element before the browser has scrolled to it. The
  browser's own scroll is what moves the window.

And one trap outside the list: a CSS reset forcing `[hidden] { display: none }`
must leave `[hidden="until-found"]` out — an element hidden with `display: none`
is never revealed. navi's own does.

Reference: `src/control/demos/19_list_find_in_page_demo.html`.

### Images in a run

An `<img>` asks for its file once it is in the DOM, and an item outside the
render window is not. So in a run, two things decide how far ahead of the screen
images load, the window and the browser, and the nearer one wins:

- **Without `loading="lazy"`**, the window decides. Every item it draws loads
  its images, so the lookahead that keeps a fling covered (three quarters of
  what the screen leaves of `renderBudget`, which is dozens of items with the
  default) is downloaded when the list opens, and again each time the window
  slides.
- **With `loading="lazy"`**, the browser decides inside the window, and each
  engine decides differently. Measured in October 2026, this is how far below
  the screen an image's top is when its request starts:

  | engine                        | distance           |
  | ----------------------------- | ------------------ |
  | Chromium                      | ~3000 px           |
  | WebKit (every browser on iOS) | ~1 viewport height |
  | Firefox                       | ~600 px            |

  Chromium keeps the same distance on 3G and on 4G. When the window's lookahead
  is shorter than the engine's distance, the window decides again.

It is a trade between bytes and images that are ready. Lazy images follow the
screen, and nothing the user never reaches is downloaded. Eager ones are
already there when a fling arrives, at the cost of a whole window of downloads.
How far ahead is enough depends on how fast the screen is crossed and how fast
a file arrives. Like the window's own lookahead, it is measured on the slowest
device and connection the list serves. Whichever you choose, give each image
its dimensions (see
[What the list knows, and what it guesses](#what-the-list-knows-and-what-it-guesses)).

`loading` only holds if it is set before `src`. `Image` does this whatever the
order of its props. A plain `<img>` written in JSX must put `loading` first:
WebKit decides when `src` is set, and an image whose `src` came first loads
whatever `loading` says afterwards.

### Doing it well

- **Skeletons at the size of their item**, and `itemSize` when the items above
  the screen come in sizes the data tells apart before it arrives (see
  [What the list knows, and what it guesses](#what-the-list-knows-and-what-it-guesses)).
- **A stable `id` on every item.** The run keys its rows on `item.id` — it is
  what addresses a row from outside (`--navi-select`, `scrolled={{ id }}`), and
  what tells a row that moved from a row that changed.
- **A stable `renderItem`.** The run hands preact the vnode it drew for an item
  last time, so an unchanged row is not walked again — only for the same
  function as last time: `renderItem` written inline in a component that
  re-renders is a new function each time, and every row is redrawn with it.
  Define it outside the component, or `useCallback` it, and let it read the
  item and the index it is given rather than closing over state.

The rest — `virtualItemSize`, the room an item not drawn is held at (uniform
items, or the smallest one of a mixed list — the worst case, see above), a `key`
on the run when the collection changes as a whole (never to refresh it, see
[list_refresh.md](./list_refresh.md#a-paginated-list-stays-on-screen-too)),
`groupBy` for sections — is in the JSDoc of `List` and `List.Items`
(`src/control/list/list.jsx`). Demos:
`src/control/demos/17_virtual_scroll_and_filter_demo.html` (a run in memory,
searched), `src/control/demos/integration/1_list_loaded_by_scroll_demo.html` (a
run reading a slice at a time).

## Many sections: `<Box mount="after-paint">`

The render window's twin for a page that is not a list — a profile, a settings
screen, sections stacked in a column. The browser paints nothing until the
render that builds the page has ended, and the sections below the first screen
weigh in it as much as those on it.

```jsx
<Box flex="y" spacing="l">
  <ProfileHeader user={user} />
  <UpcomingGames user={user} />
  <Box flex="y" spacing="l" mount="after-paint">
    <Searches user={user} />
    <Badges user={user} />
    <LinkedAccounts />
  </Box>
</Box>
```

The box is empty in the render that mounts it, and built right after the first
frame that shows the page (the first frame of its route transition, when there
is one), then kept: a later render of the page renders it as usual.

Which sections lie below the screen is not left to the app's guess, which a
taller phone or an empty first section breaks. navi looks at each box before
that frame is painted, and one the frame would show — on the screen, or above
it — is built before the paint all the same: marking too much costs a second
render in that frame, never a section popping in. A page put back where it was
left (see
[navigation.md](./navigation.md#where-a-navigation-lands-the-scroll)) has the
boxes that offset shows built before the offset is written, so the offset is not
clamped by a document still missing its bottom.

What navi cannot do is make the content exist before it is built. So the box is
only for content nothing reaches during that first frame:

- **Named controls** inside are not there until built: what a group holds for
  them waits, a value written into their own `signal` reaches nothing, and
  nothing inside checks itself (see
  [control_object.md](./control_object.md#a-control-that-is-not-there)).
- **Ids**: a `commandFor`, a popup `anchor` or a `triggerNaviCommand` aimed
  inside finds nothing, and neither does a focus put back there. A `#fragment`
  aimed inside lands a frame late, once the element is there; a popup opened
  from the address opens once built, since it reads its signal then.
- **Size**: the box has no height until it is built (a `minHeight` reserves
  one). Anything measuring it in that frame — a sticky offset, a size read from
  outside — sees it empty.

## Hover while scrolling

A scroll moves the content under a pointer that does not move, and the browser
reports that as hover on **every element crossing the cursor**. Free while hover
only paints a background; once hover triggers real work — a highlight
elsewhere, a prefetch, a map redrawing a layer — that work lands on the main
thread mid-scroll, and the scroll stutters.

### The fact is in the DOM: `navi-scrolling`

While an element scrolls it carries `navi-scrolling`, removed once it has been
quiet for a moment — scroll events stop before the movement does. Whoever is
concerned says so in CSS:

```css
/* my rows answer the pointer only when nothing is moving them */
[navi-scrolling] .my_row {
  pointer-events: none;
}
```

`pointer-events` does the whole of it: enter, move and leave at once, in the
browser, at no cost per element. Hand-written in JS the same suppression takes
three handlers — once `mouseenter` has been swallowed, only `mousemove` can
bring the hover back.

The page scroll carries the attribute on `document.scrollingElement`, so an
ancestor rule covers it too. In JS the same fact reads as `isScrolling()` /
`isScrolling(element)`, or `scrollActivitySignal` to react to it.

### In a `List`: nothing to do

`List` rows leave hit-testing while anything scrolling them moves — its own
scroll box, the panel around it, the page. `hoverWhileScrolling` opts back in.
The default costs one thing: right after a scroll, the row under the pointer
lights up only once the pointer moves by a pixel.

## The list border

Not scroll, but the same family of problem — a reasonable default nobody knows
can be removed.

A `<List>` frames itself (`--list-border-width-default: 1px`): "a list is a box
with rows in it, it says where it starts and where it ends". Inside a popup or a
card, that frame is already the container's, and two frames around the same rows
read as a box in a box. `borderWidth="0"` removes it — the prop writes
`--list-border-width` inline, which wins over the `-default`. A list that is
itself the content of a `[popover]`/`<dialog>` already drops the default on its
own.

### Without a border, no corner

The default radius is the border's, and the frame (not the scroll box) clips
the rows to its curve. A list given `border="none"`, `border="0"` or
`borderWidth="0"`, and no `borderRadius`, is marked `data-borderless`: it has
no radius, and its frame stops clipping, because rounding the corners was that
clip's only job. The scroll box still clips: a badge crossing the list's edge
is still cut there, and `overflow="visible"` remains the only way to let
content out.

- An explicit `borderRadius` keeps both the curve and the frame's clip: a
  borderless list painting a background of its own may want that surface
  rounded, with the rows clipped to it.
- Only the props turn it on. A border removed from CSS (the popup's own
  `-default`, an app class) keeps the default radius.

The curve cuts whatever sits on it: a selected row's background follows the
corner, and rows that are framed cards themselves lose their outer corners
whenever the list's radius is larger than theirs. At a fractional pixel ratio,
the frame's clip can also blur the last row's bottom edge.

Reference: `src/control/list/list.jsx` (the `.navi_list_container` CSS).
