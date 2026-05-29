# Ref composition — stable refCallback and the external ref identity problem

## Files

- `use_element_ref.js` — `useComposeElementRef` and `useElementRef` hooks
- `demo_compose_element_ref_null_bug.html` — live demo showing the bug and the fix

---

## Background: the stable refCallback pattern

Components like `Box` need to run side-effects when their DOM element appears or
changes (sync styles, forward to an external ref, measure layout, …). The
naive approach is to pass a new arrow function as `ref` on every render:

```jsx
<div
  ref={(el) => {
    externalRef.current = el;
  }}
/>
```

Preact treats a changed ref function as "old element out, new element in": it
calls the old function with `null` then the new function with the element. That
causes unnecessary unmount/remount of every side-effect on every render.

Instead, `useComposeElementRef` creates the `refCallback` **once** (stored in a
`useRef`) and returns the same function identity across all renders. Preact only
re-invokes a ref callback when the actual DOM node changes — not when the
function identity changes — so side-effects run only when they should.

---

## The bug: external ref identity changes while the DOM element stays the same

The stable `refCallback` reads `externalRef` indirectly via `externalRefRef.current`,
which is updated on every render. When the parent passes a **different** ref
object between two renders while the DOM element is unchanged, Preact does
**not** re-fire the refCallback. The new external ref's `.current` is never
populated and stays `null`.

### Why does the parent sometimes pass a different ref object?

The most common culprit is code that **mutates `props.ref`** directly:

```js
const List = (props) => {
  const refDefault = useRef(null);
  props.ref = props.ref || refDefault;  // ← mutates the VNode's props object
  ...
};
```

Preact reuses VNode objects across reconciliation cycles. When this component
renders it writes into the VNode's `props` object. On the next render, if the
parent didn't pass a ref, the VNode still carries the mutated value from the
previous render. So if the component unmounts and remounts (e.g. because an
ancestor switched between `<div>` and `<dialog>`), a fresh component instance
is created, `useRef` allocates a new `refDefault_2`, but the VNode's
`props.ref` still points to `refDefault_1` from the previous mutation.

Sequence with mutation:

| Render            | props.ref passed by parent | refDefault created | externalRef seen by Box           |
| ----------------- | -------------------------- | ------------------ | --------------------------------- |
| 1                 | `undefined`                | `refDefault_1`     | `refDefault_1` ✅ (from mutation) |
| 2 (after remount) | `undefined`                | `refDefault_2`     | `refDefault_1` ← stale!           |
| Read              | —                          | —                  | `refDefault_2.current = null` 💥  |

The **correct fix at the mutation site** is to never mutate props:

```js
const ref = props.ref || refDefault; // local variable, no mutation
```

This was the primary fix applied to `List`.

---

## The defensive fix in useComposeElementRef

Because the mutation pattern is easy to accidentally reintroduce (and because
`Box` can't control what its ancestors do), `useComposeElementRef` — and `Box`'s
own inline ref handling — also defend against this at the forwarding level.

On every render, the previous `externalRef` is compared to the current one. If
the identity changed:

1. **Clear the old ref** — set `prev.current = null` so the stale ref doesn't
   keep a dangling reference to a DOM node it no longer owns.
2. **Populate the new ref** — immediately write `externalRef.current = elRef.current`
   so the new ref is valid right away, without waiting for Preact to re-fire
   the refCallback (which it won't, because the DOM element didn't change).

```js
if (prevExternalRefRef.current !== externalRef) {
  const prev = prevExternalRefRef.current;
  if (prev && typeof prev !== "function") prev.current = null;
  if (externalRef && elRef.current) {
    if (typeof externalRef === "function") externalRef(elRef.current);
    else externalRef.current = elRef.current;
  }
  prevExternalRefRef.current = externalRef;
}
```

---

## Live demo

Open `demo_compose_element_ref_null_bug.html` to see three scenarios side by
side, all rendered automatically on load:

1. **Bug** — parent swaps `refA` → `refB` between renders; `refB.current` stays
   `null` with the buggy hook.
2. **No bug** — same buggy hook, but the parent always passes the same ref
   object; identity never changes so the stable refCallback is sufficient.
3. **Props mutation + fix** — a child mutates `props.ref` (the old `List`
   pattern), causing the identity to change; with `useComposeElementRefFixed`
   the new ref is synced immediately and the crash is avoided.
