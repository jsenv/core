# The states of a screen's data

A screen reading async data draws one of a handful of states, and there are two
ways to get it wrong. Both are common, and both come from the same shortcut.

- **A wait announced over something that is not coming.** A skeleton drawn on
  "there is no data" alone keeps shimmering after the load failed, and after the
  params turned out to be false. It says "hold on", and there is nothing to hold
  on for.
- **Content taken away because something behind it went wrong.** A list that
  disappears because its refresh failed; a page replaced by a message while the
  rows it had are still perfectly good, and still true a second ago.

The shortcut behind both: collapsing "loading", "empty" and "failed" into one
state — _not ready_ — and drawing one thing for it. They are three separate
questions, and a screen that draws honestly answers them separately:

- **is there something to show?** → `data`
- **is anything on its way?** → `loading`
- **did the last attempt fail?** → `error`

navi's part is to answer all three, at every render, and to keep answering them.
What is drawn for each is the component's, always: navi has no opinion on
whether a missing list is a skeleton, a sentence or an illustration.

## Asking for a state means receiving it as a value

Without options, `useAsyncData` **delegates**: it suspends while the data is not
there and throws when the action failed, so the states are drawn by the
`<Loading>` and `<ErrorBoundary>` above rather than by the component.

Each option turns one of those from something done _to_ the component into a
value the component reads:

| passed          | the wait                  | the failure                  |
| --------------- | ------------------------- | ---------------------------- |
| nothing         | suspends into `<Loading>` | throws to `<ErrorBoundary>`  |
| `loading: true` | `loading`, a boolean      | throws                       |
| `error: true`   | suspends                  | `error`, plus `dismissError` |
| both            | `loading`                 | `error`                      |

The invariant that makes this worth relying on: **`loading: true` never
suspends.** Not while the action runs, not while a debounced binding is
settling, not while it holds params nobody has started yet, not after a failure
whose message was dismissed. Every one of those comes back as a value.

That is not a detail of the wait — it is what keeps the component alive.
Suspending does not draw a spinner over a subtree: it takes the subtree away and
puts the boundary's fallback in its place, and everything under it is remounted
when it comes back. A dialog open inside it closes, a scroll position is lost,
half-typed text is gone, and the retry button the component was offering
disappears along with the component. A component that said it draws its own
states is never taken away from the person looking at it.

`error: true` says the same thing about failure, and it has the same
consequence: the component stays, so it is still there to offer the way out.

A component that delegates nothing needs no `<Loading>` above it. One that
delegates its wait does, since that is where the suspension lands, and navi says
so rather than leaving the subtree blank.

## `data` and `loading` are independent

They answer different questions, so all four combinations happen and each one
means something different:

| `data`      | `loading` | what it is                    | what a screen draws      |
| ----------- | --------- | ----------------------------- | ------------------------ |
| `undefined` | `true`    | first load                    | a skeleton, animated     |
| set         | `true`    | a refresh over a known answer | the content, marked busy |
| set         | `false`   | settled                       | the content              |
| `undefined` | `false`   | nothing here, nothing coming  | an empty state           |

Two consequences worth stating out loud.

**The emptiness test is `data === undefined`, never `loading`.** Reading
`loading` as "there is nothing to display" blanks the screen on every refresh —
for a checkbox ticked on one row of a list, the whole list goes.

**A skeleton is told whether it is loading; it does not deduce it.** The last
row of the table is the one that gets forgotten, and it is reachable: a first
load that failed — its message on screen or dismissed — and a route action whose
params getter returns false. A skeleton drawn on emptiness alone shimmers there
forever, claiming a load nobody started.

```jsx
const [items, loading] = useAsyncData(ACTION, { loading: true });
if (items === undefined) {
  return <ItemsSkeleton loading={loading} />;
}
return <ItemList items={items} busy={loading} />;
```

navi's own placeholders take that flag rather than inventing it: `<Text loading>`
shimmers, `<Text skeleton>` is the same bar held still, and `<Text skeleton
loading={loading}>` is one that tells the truth either way.

**Knowing the count beforehand beats guessing it.** How many skeleton rows to
draw is a question the response answers too late; a screen that already knows —
a count carried by the parent resource, a total returned alongside a previous
page — says so, and `<List loading loadingSkeletonCount={0}>` draws the empty
state right away instead of three rows that will vanish. Nothing jumps when the
response lands.

## An error is a message on the screen, not the screen

`error: true` hands the failure over **beside** the data the action already had,
not in place of it. A refresh that failed does not unmake the previous answer,
so a screen that had something to show keeps it and says the failure over it:

```jsx
const [items, loading, error, dismissError] = useAsyncData(ACTION, {
  loading: true,
  error: true,
});
if (error && !items) {
  return <ErrorScreen error={error} />; // nothing behind it: the message is the screen
}
return (
  <>
    {error && <ErrorStrip error={error} onClose={dismissError} />}
    <ItemList items={items} busy={loading} />
  </>
);
```

`dismissError()` removes the message and nothing else — nothing is asked again,
because nothing had to be: what closing it reveals was already there. What comes
back is the same state minus the error, which is why the two branches above stay
honest afterwards.

Taking the whole subtree away is `<ErrorBoundary>`'s job and it is a different
decision: reach for it when the failure means the screen genuinely cannot be
drawn, not as a stronger version of the same thing. Which of the two, and where
an error goes when neither takes it, is
[error_handling.md](./error_handling.md).

## Reference

- [error_handling.md](./error_handling.md) — the two kinds of error, where each
  is shown, and what happens to one nobody displays.
- [list_refresh.md](./list_refresh.md) — the same states for a list, plus what a
  write puts back on screen with no request at all.
- [actions.md](./actions.md#reading-an-action) — reading an action versus
  running one, `{ run: true }`, `{ onLoad }`.
- `src/state/demos/use_async_data_demo.html` — one card per shape: delegated,
  loading inline, both inline, owning its request.
