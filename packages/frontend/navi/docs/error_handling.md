# Error handling

There are two kinds of error in an app, and everything here exists to keep them
apart:

- **what the person can see and act on** — offline, a 404, the server refusing
  a value. That is data. It must be displayed, and displayed where it makes
  sense for what just happened;
- **a bug** — a `TypeError`, a contract broken. That must be as loud as
  possible, and must never be swallowed by the machinery built for the first
  kind.

The rule the whole thing rests on: **displaying an error is claiming it.**
Whatever puts an error on screen says so, and an error nobody claimed is
treated as a bug. Nothing has to guess which kind it is, and nothing has to
guess at the wrong moment — the answer is given after the fact by what actually
rendered.

## Where an error appears depends on where it came from

### Someone just acted — a control's action

A `<Button action>`, a `<Form>` submit: the person did something and is waiting
for the answer, so the answer belongs where they acted. navi shows it as a
validation message on the **requester** (the submit button, not the form):

```jsx
<Button action={GAME.POST.bindParams(values)}>Créer</Button>
```

- `errorMapping(error)` turns the raw error into what to show: a string, an
  `Error`, an element, or `{ message, target }` to point the message at another
  element.
- The message is a constraint on the control (`navi_action_error`) rather than a
  render of its own, and it **auto-resets on the next action**: hitting submit
  again clears it and re-submits, instead of the form being stuck invalid.
- `actionErrorEffect` changes that: `"throw"` re-throws the error from a layout
  effect so the nearest `<ErrorBoundary>` takes it (a control cannot throw from
  an event handler and be caught — see the comment in
  [use_execute_action.js](../src/action/use_execute_action.js)), and anything
  else — `"none"` — means the control displays nothing because something else
  does. `<Details>` uses that: its `<ActionRenderer>` shows the error inside the
  open panel.

### A screen's data failed — a route action

Nobody clicked; the page simply cannot be drawn. It is the page, or a piece of
it, that is replaced — by an ancestor, never by a prop on the page. That is what
`useAsyncData`'s default means: **delegate**. The component says what it renders
when it has data, and what it cannot render is somebody else's job, up the tree:

```jsx
<Route>
  <ErrorBoundary
    fallback={({ error, resetError }) => (
      <ErrorScreen error={error} onRetry={resetError} />
    )}
  >
    <Loading fallback={<GameSkeleton />}>
      <Route route={GAME_ROUTE} element={GamePage} />
      <Route route={GAMES_ROUTE} element={GamesPage} />
    </Loading>
  </ErrorBoundary>
</Route>
```

Two things about that shape:

- The boundary goes **outside** the `<Loading>`. A page suspends first and fails
  second; a boundary placed under the `Suspense` it suspended in is part of the
  tree being held.
- It is written **between** a container `<Route>` and its branches, and the
  container reads through it — the selected branch keeps whatever was written
  around it. So a boundary can bracket a section of the pages instead of the
  whole router, without the router having to know it exists.

Inside the component when the error is part of what the screen draws rather than
a screen of its own:

```jsx
const [game, loading, error, dismissError] = useAsyncData(gameAction, {
  loading: true,
  error: true,
});
```

And one row rather than the whole list: `<List.Item error>` replaces the row's
content with the message — what the row stood for did not happen, so drawing it
as if it had would be a lie.

### A value is refused — validation

Not an error at all, and not to be modelled as one: a value the app or the
browser refuses is a **status on the control**, carried by navi's constraint
validation. Never throw to reject a value — see `src/control/rules/`.

An app's own rule joins that set as a constraint — `{ name, check }`, where
`check(field)` reads `field.uiState` and returns a message or `null`:

```jsx
<Input constraints={[TEXT_SHAPE_CONSTRAINT]} />; // this control
registerGlobalConstraint(TEXT_SHAPE_CONSTRAINT); // every control
```

A constraint is an object, so it carries whatever it needs to decide — there is
nothing to pass through an attribute. The attributes the shipped constraints
read (`required`, `data-single-space`, `data-displayable`…) exist because those
constraints are global and need a per-field switch; a constraint written for
one call site does not.

## What a failing action does

It writes the error into `errorSignal`, moves to `FAILED`, and stops.

**A run never rejects.** `run()`, `rerun()`, `prerun()` settle with the error as
their value. Nothing about a failed action arrives as a rejected promise, so
there is no floating rejection to catch and no navigation that has to await one
to stay quiet. Code that wants the error asks for it — `useAsyncData`,
`errorSignal`, or an `onError` passed to the run.

Why it does no more than that: **at the instant an action fails, nothing can
know whether a screen will display it.** A route action runs before its page
renders — often before that page exists — so any decision made there about "will
someone show this?" is a guess, and it is wrong for the most common case in the
app. So no decision is made there.

## Claiming an error: `__handled_by__`

Whatever displays the error sets `error.__handled_by__` (via
`markErrorAsDisplayedBy` in
[action_error_report.js](../src/action/action_error_report.js)). That mark means
one thing and only one: **this error is on screen somewhere.**

It is the same mark the jsenv supervisor reads to keep its dev overlay out of
the way. It has to exist because `preact/debug` re-throws, in a `setTimeout`,
**every error a boundary handled** — deliberately, so that React-style dev
overlays keep working:

```js
// when an error was handled by an ErrorBoundary we will nonetheless emit an error
// event on the window object. This is to make up for react compatibility in dev mode
// and thus make the Next.js dev overlay work.
```

Without the mark, an app calmly displaying "you are offline" gets a crash
overlay thrown over it.

Everything navi ships already marks: `<ErrorBoundary>` when it renders its
fallback, `<ActionRenderer>` / `<Button action>` when they render their error
branch, `useAsyncData({ error: true })`
when it hands the error to the component, and a run given an `onError` — asking
for the error is taking it.

## Taken by nobody: the report

An error that no render ever read is re-thrown, which makes it an ordinary
unhandled error — window `error` event, jsenv overlay in dev — pointing at the
code that produced it.

**Being read is enough to call the report off**, displayed or not. Once a render
has the error, everything that can happen next is already covered without this
module: it is displayed (and marked), or it is thrown — and a thrown error either
finds a boundary that displays it, or reaches window on its own, since
`preact/debug` re-throws what a boundary caught and an unbounded throw aborts the
render loudly. Reporting it here too would be a second voice, and the wrong one:
this module cannot see which of those happened.

So what reaches the report is an error **nothing looked at** — an action nobody
reads, a prerun for a page never opened. And _when_ it is reported follows from
that:

- one macrotask, because every render that could read it happens in microtasks;
- but a route action fails ON the url change, before its page exists — it is the
  routing itself that brings what will display the error. So the deadline waits
  for the document to stop moving and for the frame that paints what the routing
  brought. Anything faster tells an app that is displaying "you are offline" that
  it displayed nothing (measured: the screen arrived ~12ms after a plain
  macrotask deadline).

Waiting longer costs nothing, precisely because a read is enough to call it off:
what is still unread by then was going to stay unread. The same error reaching
the report twice is reported once.

## Writing your own boundary

navi's `<ErrorBoundary>` is what a boundary must be, and both of its rules are
easy to miss when writing another one:

- **Mark only what you actually render.** Marking on catch, before knowing
  whether anything is displayed, turns a boundary into a bug swallower: a
  `TypeError` in a component becomes a blank page AND a silent one, since the
  mark muted the overlay that would have pointed at it. navi's boundary marks
  just before rendering its fallback, and re-throws untouched when it has no
  fallback — nothing to display means nothing handled.
- **Reset on the document URL, not only on the rerun.** Re-running the failed
  action is one way out; going somewhere else is the common one. A boundary that
  only watches the action stays in place of every page after the failure,
  including the ones that would render fine.

The one reason to write your own: **filtering what you take.** navi's takes
everything its subtree throws. An app that wants its own bugs to stay visible
displays only what is data to it — an error carrying an HTTP status, its own
`OfflineError` — and re-throws the rest **unmarked**, so the overlay still does
its job. `markErrorAsDisplayedBy` and `errorIsDisplayed` are exported for that:

```jsx
const PageErrorBoundary = ({ children, fallback }) => {
  const [error, resetError] = useErrorBoundary();
  if (!error) {
    return children;
  }
  if (!isDisplayableError(error)) {
    throw error; // our bug: unmarked, so it stays as loud as it is
  }
  markErrorAsDisplayedBy(error, "<PageErrorBoundary>");
  return h(fallback, { error, resetError });
};
```
