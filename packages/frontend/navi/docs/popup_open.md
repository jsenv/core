# Opening a popup

What opens a `Dialog` or a `Popover`, and who owns the fact that it is open.

- [The popup owns its open state](#the-popup-owns-its-open-state)
- [A button opens it: the attributes](#a-button-opens-it-the-attributes)
- [Something else opens it: `triggerNaviCommand`](#something-else-opens-it-triggernavicommand)
- [Which element receives the command](#which-element-receives-the-command)
- [The anchor](#the-anchor)
- [Opening it ON something](#opening-it-on-something)
- [Reacting to open and close](#reacting-to-open-and-close)
- [Escape cancels, the other gestures keep](#escape-cancels-the-other-gestures-keep)
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
`--navi-confirm` (says yes, then closes). What "revert" does to what is inside
is [its own section](#escape-cancels-the-other-gestures-keep) — it is also what
Escape says.

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

## Opening it ON something

A popup that edits is never only open or closed: it is open **on** something. A
dialog that is "new radar" from the top of a list and "edit this radar" from a
row is one dialog with two modes, and the press is the only thing that knows
which one — so the press says it, with its own value:

```jsx
<Button command="--navi-open" commandfor="radar-dialog">Nouveau radar</Button>
<Button value={radar.id} command="--navi-open" commandfor="radar-dialog" />

<Dialog
  id="radar-dialog"
  unmountWhenClosed
  onOpen={(e) => {
    editedRadarIdSignal.value = e.detail.value; // undefined = création
  }}
>
```

That subject travels as the command's **value**, not as an argument after a
colon (`--navi-open:radar-42`). The two places say different things and the
distinction holds across every command: an argument says WHAT the command does —
`--navi-go-to-slide:edit` needs one, "go" without a destination is not an
instruction — and `value` says what it is about. "Open" is already a complete
instruction; the radar is what it is about. A button therefore says it the way it
says it everywhere else, with `value`, and nothing has to be parsed.

A JS decision says the same thing through the same door:

```js
triggerNaviCommand(dialogRef.current, "--navi-open", event, {
  value: radar.id,
});
```

`--navi-toggle` carries it too, on the half that opens.

### `onOpen` runs before the popup has built anything

The order is the whole point, and it is a guarantee, not a coincidence:

```
onOpen(openEvent)   ← the subject is decided here
children mounted    ← unmountWhenClosed rebuilds them from scratch, on that subject
positioned, shown
```

So a dialog whose content is seeded once — an uncontrolled field on a
`defaultValue`, a form keyed on what it edits — reads the right thing on its very
first render. Learning it afterwards would mean mounting on the previous subject
and correcting it, which is a flicker at best and stale fields at worst.

The two other places one could listen are not that moment, and it is worth
knowing why:

| where                         | when it runs                   | chained to the caller |
| ----------------------------- | ------------------------------ | --------------------- |
| `onOpen`                      | before the content is built    | yes — this prop       |
| `onnavi_command` on the popup | after the command has been run | yes                   |
| `navi_request_open` listener  | before the popup's own handler | on the element only   |

`onnavi_command` receives the whole command string and its value, but it runs
**after** the opening: whatever it writes lands on a popup that is already open.
That works only as long as nothing has read the state yet — which
`unmountWhenClosed` makes a real race rather than a theoretical one.

A `navi_request_open` listener added on the element is the request itself, ahead
of the popup acting on it — but it is ordered against the popup's own handler by
registration, and it has to be attached in an effect on a ref. `onOpen` is that
moment, said as a prop.

## Reacting to open and close

`onOpen` is called on every open, before the popup builds anything (see
[above](#opening-it-on-something)); `onClose` is called on every real close, and
carries `detail.isCancel` when the close meant "revert".

```jsx
<Dialog onOpen={(e) => {}} onClose={(e) => {}}>
```

Neither can veto: `onClose` is the close happening, not a request to close.
Refusing a close is `onRequestClose`, which belongs to whoever owns an
`openController` (see `open_controller.js`) — an uncontrolled popup already
refuses the one close that matters, the one over a control mid-action.

### Closing when a button also runs an action

Closing from inside the `action` does not close. While the action runs, the
button that started it is busy, and a busy control is exactly what a popup
refuses to close over (see the top of this page). The refusal is not silent —
the busy control raises a callout saying so — but the popup stays open, and the
first Escape afterwards dismisses that callout rather than the popup, which
reads as a popup that no longer closes at all.

There are two shapes, and they say different things:

```jsx
// Closes on the press. The popup does NOT wait for save(): it is already
// closed when the action starts, and the action finishes behind it.
<Button command="--navi-close" commandfor="note-dialog" action={save}>
  Save
</Button>
```

`command` next to `action` is the one to reach for when the answer is taken as
soon as it is given — the popup gets out of the way, the save runs on its own.
Know what it costs: **a save that fails does so behind a closed popup**, and the
error callout it raises lands on a button nobody can see any more. Use it where
the failure is reported somewhere else, or where losing it is acceptable.

```jsx
// Closes only once save() has resolved, and stays open if it throws.
<Button
  action={save}
  onActionEnd={() => {
    // NOT synchronously: the button still counts as busy while its own
    // action-end handlers run, and the popup would refuse the close.
    queueMicrotask(() => {
      triggerNaviCommand(dialogRef.current, "--navi-close");
    });
  }}
>
  Save
</Button>
```

`onActionEnd` only fires when the action succeeded, so the popup stays open on
failure — the answer is then neither committed nor given up, and it is still
there to be corrected, with the error shown on the button that raised it.

## Escape cancels, the other gestures keep

The gestures that close a popup do not all mean the same thing, and that is on
purpose:

| gesture                         | what it means | who decides                                         |
| ------------------------------- | ------------- | --------------------------------------------------- |
| Escape                          | cancel        | `escapeEffect="cancel"` (default)                   |
| a click outside                 | close, keep   | `pointerInteractionOutsideEffect="close"` (default) |
| a close button (`--navi-close`) | close, keep   | the button                                          |
| `--navi-cancel` on a button     | cancel        | the button                                          |

Escape says "forget it". It is the one gesture that has meant that everywhere,
for as long as there have been dialogs, and navi keeps it that way. **A popup
that must offer a way out that KEEPS what was chosen offers it with a close
cross, or by letting the click outside close** — not by teaching Escape to say
something else.

### What "cancel" actually undoes

Cancelling is not itself an undo: it marks the close, and whoever holds a value
decides what to do with the mark.

- `Dialog` and `Popover` hold nothing, so they undo nothing. The close event
  carries `detail.isCancel` and `onClose` receives it — reverting is then the
  caller's own business.
- `Picker` holds a value, so it puts back **the value it held when it opened**.
  That is what makes a picker a picker: opening one is trying something on, and
  Escape is putting it back.

```jsx
// Escape here puts back the level the picker held at open, and the list's
// uiAction fires with that restored value — the draft goes back with it.
<Picker id="level" ui={…}>
  <List selectable multiple value={draft.levels} uiAction={…}>…</List>
</Picker>
```

The trap is the FIRST open. A picker holds what its popup told it, and before
the popup has ever been open it has been told nothing — so "the value at open"
is nothing, even when the control inside starts on a `defaultValue` or on a
value the app passes it. Escape on that first pass goes back to empty, not to
what was on screen when the popup opened. From the second open onwards it puts
back what was really there.

### A picker that holds nothing and shows nothing

The gestures that KEEP (a click outside, a close cross) let a picker send what
it is showing: a picker sitting on a `defaultValue` holds nothing, so closing on
it untouched IS the answer ("yes, 1h30"), and the action runs.

A picker used as a **menu of gestures** — no `value`, no `defaultValue`, no
signal, each row a command — shows nothing, so there is nothing to confirm.
Closing it without choosing runs no action; only an explicit choice sends.

```jsx
// Clicking outside closes this and sends nothing.
<Picker id="pause" mode="popover" variant="icon" action={pauseAction}>
  <List selectable command="--navi-send">
    <List.Item selectable id="24h" value="24h">
      …
    </List.Item>
  </List>
</Picker>
```

Note this is about a picker holding NOTHING. Passing `value={undefined}` is not
that: a `value` prop is held whatever is in it, and navi puts it back after each
click — the rows then appear to do nothing. Drop the prop instead of passing it
empty.

### `escapeEffect="close"`, and why it is a last resort

`escapeEffect="close"` makes Escape say what a click outside says. It exists,
and it is almost never what you want: it takes away the only key that undoes,
and a popup with no way back is one people stop opening. Reach for a close
cross first.

A dialog picker's cancel also goes back in history, so anything written to the
url while it was open (a route `stateSignal`, a search param) goes back with it
— one more reason Escape and the click outside are not interchangeable.

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
