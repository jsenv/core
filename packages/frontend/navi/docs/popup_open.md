# Opening a popup

What opens a `Dialog` or a `Popover`, and who owns the fact that it is open.

- [The popup owns its open state](#the-popup-owns-its-open-state)
- [A button opens it: the attributes](#a-button-opens-it-the-attributes)
- [Something else opens it: `triggerNaviCommand`](#something-else-opens-it-triggernavicommand)
- [Which element receives the command](#which-element-receives-the-command)
- [The anchor](#the-anchor)
- [Reacting to open and close](#reacting-to-open-and-close)
- [When `open` is the right answer, and what it costs](#when-open-is-the-right-answer-and-what-it-costs)
- [What the popup holds while it is closed](#what-the-popup-holds-while-it-is-closed)

## The popup owns its open state

A `Dialog`/`Popover` with no `open` prop keeps its own open state and listens
for requests to change it. That is the default way to use one, and it buys
something a `useState` in the parent cannot give back: **a popup refuses to
close while a control inside it is mid-action**.

```js
// what both do on every close request
const busyElement = findBusyElementInside(popupEl);
if (busyElement) {
  dispatchRequestInteraction(busyElement, { ... });
  requestCloseEvent.preventDefault();
}
```

A form that is sending holds an answer that is neither committed nor given up.
Escape, the backdrop, a close button — all of them ask, and the busy control
answers, the same way it would answer anyone else.

So the question is never "should this popup be controlled?" but "what triggers
the opening?":

| what opens it                      | how                                            |
| ---------------------------------- | ---------------------------------------------- |
| a button                           | `command` / `commandfor` attributes, no `open` |
| a gesture, an event, a JS decision | `triggerNaviCommand(...)`, still no `open`     |
| it is a piece of application state | `open` — see the cost below                    |

## A button opens it: the attributes

```jsx
<Button command="--navi-open" commandfor="note-dialog">
  Read the note
</Button>
<Dialog id="note-dialog">…</Dialog>
```

The available commands: `--navi-open`, `--navi-close`, `--navi-toggle`,
`--navi-cancel` (closes, telling the popup the close means "revert"),
`--navi-confirm` (says yes, then closes).

## Something else opens it: `triggerNaviCommand`

The attributes fire on every click of the element that carries them. As soon as
the opening is a decision rather than a click — a long press, the end of a drag,
a double-click, a keyboard shortcut, a server answer, an `IntersectionObserver` —
the decision has to be made in JS, and the command triggered from there:

```jsx
import { triggerNaviCommand } from "@jsenv/navi";

const dialogRef = useRef(null);
const open = (event) => {
  if (draggedRef.current) {
    // the click that ends a throw is not a request to open
    return;
  }
  triggerNaviCommand(dialogRef.current, "--navi-open", event);
};

<Box role="button" onClick={open}>…</Box>
<Dialog ref={dialogRef}>…</Dialog>
```

This is the same entry point the attributes go through: same target resolution,
same command proxies, same events. The popup stays uncontrolled, and keeps its
say over closing.

`event` is the DOM event the decision came from. Pass it whenever there is one:
it is chained into the request event, and that chain is what lets the popup
handle focus correctly (which element to give focus back to, whether a
mousedown's click must be swallowed). Omit it only when nothing user-initiated
triggered the command.

## Which element receives the command

The first argument is the command's **source** — the element it is triggered
_from_. The target is resolved from it, in this order:

1. `commandfor="someId"` on the source,
2. `navi-command-target="parent-control" | "child-control"`,
3. the command's own fallback — for the popup commands, `closest("[aria-expanded]")`.

A popup carries `aria-expanded` from its very first render, so passing the popup
element itself as the source resolves to that popup: `closest()` starts at the
element itself. That is the short form used above, and it is enough whenever the
JS that decides already holds the popup's ref.

To trigger from another element instead, give that element a `commandfor`
pointing at the popup's `id` — attribute-driven target resolution, JS-driven
timing.

## The anchor

A popup with no `anchor` prop uses the command's source as its anchor
(`detail.anchor ?? detail.source`). Passing the popup itself as the source
therefore makes it its own anchor. For `Dialog` this only affects the
`--anchor-width`/`--anchor-height` CSS vars; for `Popover`, which really is
positioned relative to its anchor, say what the anchor is:

```jsx
<Popover ref={popoverRef} anchor={rowRef}>
```

The `anchor` prop always wins over whatever the command carried.
`anchorCustomEventDetail="ignore"` (Popover only) goes further and drops the
event's anchor entirely, for a popover that must never be anchored to whatever
opened it.

## Reacting to open and close

`onClose` is called on every real close. There is no `onOpen`: an uncontrolled
popup rewrites its own open handler, so a passed one would never run. Listen on
the ref instead — or, when the JS that opens is yours, do the work right where
you trigger the command.

```js
useLayoutEffect(() => {
  const dialog = dialogRef.current;
  const onOpen = () => {
    /* … */
  };
  dialog.addEventListener("navi_request_open", onOpen);
  return () => dialog.removeEventListener("navi_request_open", onOpen);
}, []);
```

## When `open` is the right answer, and what it costs

`open` is for a popup whose being-open is a fact about the application, not
about the user's last gesture: a route that _is_ a dialog, an error the app
decides to show. Use it there, and know what it changes.

The busy arbitration still runs — `open={false}` goes through the same
`requestClose` — but nobody hears the refusal. The parent's state says closed,
the popup stayed open, and the two disagree from then on: the effect only reacts
to `open` _changing_, so setting it back to `true` matches the popup's real
state and does nothing, and the popup can no longer be closed by the prop at
all until it closes on its own.

`defaultOpen` is the middle ground: mount-only, and the popup owns everything
afterwards. `defaultOpen="interaction"` means the mount _is_ the opening (the
entrance animation plays); any other truthy value means it was already open when
the page appeared (no entrance).

## What the popup holds while it is closed

A closed popup builds nothing: `children` are mounted on the first open, and
stay mounted afterwards — a reopened popup finds its scroll position and its
half-typed form where it left them.

Two props move that line:

| prop                | effect                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `mountWhenClosed`   | build `children` right away — for content something depends on before any opening (a value read off it, fields a surrounding form submits, a size measured from outside) |
| `unmountWhenClosed` | throw `children` away once the popup has finished closing — for content whose fresh state is its initial state                                                           |

`unmountWhenClosed` is what an uncontrolled field seeded from a `defaultValue`
needs: without it, a popup reopened after the underlying value changed still
shows what it showed at closing time.

```jsx
<Dialog ref={dialogRef} unmountWhenClosed>
  <Textarea defaultValue={note.text} />
</Dialog>
```

The content is dropped only once the exit transition is over, so the popup never
plays it on a blank surface; a popup reopened while it was leaving keeps the
content that opening just asked for. `mountWhenClosed` wins if both are set.
