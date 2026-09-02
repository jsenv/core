# Opening a popup

What opens a `Dialog` or a `Popover`, and who owns the fact that it is open.

- [The popup owns its open state](#the-popup-owns-its-open-state)
- [A button opens it: the attributes](#a-button-opens-it-the-attributes)
- [Something else opens it: `triggerNaviCommand`](#something-else-opens-it-triggernavicommand)
  - [The event is forwarded, not invented](#the-event-is-forwarded-not-invented)
- [Which element receives the command](#which-element-receives-the-command)
- [The anchor](#the-anchor)
- [Opening it ON something](#opening-it-on-something)
- [A press that opens a popup and acts on it](#a-press-that-opens-a-popup-and-acts-on-it)
- [Reacting to open and close](#reacting-to-open-and-close)
- [Escape cancels, the other gestures keep](#escape-cancels-the-other-gestures-keep)
- [When the app holds the open state](#when-the-app-holds-the-open-state)
- [A popup that loads data](#a-popup-that-loads-data)
- [What the popup holds while it is closed](#what-the-popup-holds-while-it-is-closed)

Where the focus goes once it is open is its own subject — see
[autofocus.md](./autofocus.md).

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
the opening?" — and, when the answer is the application rather than a gesture,
where that state lives:

| what opens it                      | how                                                    |
| ---------------------------------- | ------------------------------------------------------ |
| a button                           | `command` / `commandfor` attributes, no `open`         |
| a gesture, an event, a JS decision | `triggerNaviCommand(...)`, still no `open`             |
| a state the app holds              | `signal` — [below](#when-the-app-holds-the-open-state) |
| where the user is                  | `navState`, or a route `stateSignal` given to `signal` |

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
Escape says. `--navi-close:all` closes every popup above the button, nearest
first; a popup that refuses to close keeps the ones above it open too. A link
that leaves is the usual case — a badge shown over a sheet, both left in one
press:

```jsx
<Link href={PLAYER_ROUTE.buildUrl({ playerId })} command="--navi-close:all">
  Profil
</Link>
```

## Something else opens it: `triggerNaviCommand`

The attributes fire on every click of the element that carries them, and they
cover more than "this button opens that dialog": `commandfor` says to whom,
`value` says what it is about, `--navi-x:argument` says how. Before writing any
JS here, check none of those is the answer — `triggerNaviCommand` is the last
resort, not the general way to run a command.

What it is for is a decision rather than a click — a long press, the end of a
drag, a double-click, a keyboard shortcut, a server answer, an
`IntersectionObserver`:

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

### The event is forwarded, not invented

`event` is what caused the decision, and it is mandatory — triggering a command
without one throws. It is chained into the request event, and that chain is what
lets the popup handle focus correctly (which element to give focus back to,
whether a mousedown's click must be swallowed) and what the debug panel groups
the whole sequence under.

So the event to pass is **the one that is already there**, threaded down through
every function between the handler and the call. A `CustomEvent` built on the
spot satisfies the signature and defeats its purpose: the origin is a name
instead of a gesture, and everything read off the real event is gone.

```js
// ✗ the handler drops the event, the command is told a story instead
const openMenu = () => {
  const openEvent = new CustomEvent("open");
  triggerNaviCommand(popoverRef.current, "--navi-open", openEvent);
};

// ✓ the handler passes on what it was given
const openMenu = (event) => {
  triggerNaviCommand(popoverRef.current, "--navi-open", event);
};
```

A helper several presses share takes the event as a parameter like any other;
the same holds one layer deeper, when the decision is taken by something navi
handed an event to — an `interactions` detector, an `onOpen`, an action's
callback. Follow it back: there is a gesture at the start of nearly every
sequence.

The exception is the sequence that genuinely started on its own — a timer
firing, an action settling, a signal changing. Then say what happened with a
`CustomEvent` named after it, rather than leaving the origin unsaid:

```js
import { chainEvent, triggerNaviCommand } from "@jsenv/navi";

const expiredEvent = new CustomEvent("session_expired");
chainEvent(expiredEvent, causeEvent); // when something did precede it
triggerNaviCommand(dialogRef.current, "--navi-open", expiredEvent);
```

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
therefore makes it its own anchor. For `Dialog` the anchor does nothing at all
unless `sizeFromAnchor` is passed (then, and only then, it feeds the
`--anchor-width`/`--anchor-height` CSS vars); for `Popover`, which really is
positioned relative to its anchor, say what the anchor is:

```jsx
<Popover ref={popoverRef} anchor={rowRef}>
```

The `anchor` prop always wins over whatever the command carried.
`anchorCustomEventDetail="ignore"` goes further and drops the event's anchor
entirely — for a popover that must never be anchored to whatever opened it
(`SidePanel` does this), and for a `sizeFromAnchor` dialog that must never be
sized from it.

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
  mount="while-opened"
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
children mounted    ← mount="while-opened" rebuilds them from scratch, on that subject
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
`mount="while-opened"` makes a real race rather than a theoretical one.

A `navi_request_open` listener added on the element is the request itself, ahead
of the popup acting on it — but it is ordered against the popup's own handler by
registration, and it has to be attached in an effect on a ref. `onOpen` is that
moment, said as a prop.

## A press that opens a popup and acts on it

A press that opens something and then does something with what came of it — a
"save this guest" prompt on a row, which replaces the guest once the profile
exists — is not a dialog plus a way home. It is a `Picker`: a trigger, a popup,
and an `action` that runs on what the popup settled.

```jsx
// one per row: the trigger IS the thing that receives the answer
<Picker
  variant="icon"
  rightSlotIcon={<DisketteSvg />}
  action={async (created) => {
    await USERS.GET_MANY.rerun();
    replaceGuest(guest, created);
  }}
>
  <GuestSavePrompt kind="player" name={guest.name} />
</Picker>
```

Two things fall out of writing it this way, and both are the reason to prefer it
over a shared dialog opened by `--navi-open`:

- **what the popup needs to know travels as props**, because the popup is
  written where the press is. No value to carry through the command, nothing to
  read back out of an event;
- **the popup is built the first time it opens**, not once per row on the render
  that draws the list (see [what a popup holds while it is
  closed](#what-the-popup-holds-while-it-is-closed)). A hundred rows is a
  hundred triggers, not a hundred dialogs.

The same component can of course be written once and used in every picker —
`<GuestSavePrompt>` above is one — so "the prompt exists once" is a question
about components, not about the DOM.

### Composing a value, or doing work

A picker mirrors **one** control in its popup — the first one that is not a
button, a link or a control that answers for itself (`standalone`). That
mirror is what makes `<Picker><List selectable/></Picker>` work with nothing
wired: the picker's value IS the list's, both ways, and the picker's `action`
runs on it when the popup closes.

That is the shape for a popup that **composes a value**. A popup that **does
work** — creates a profile, uploads a file — is the other shape, and it does not
need the picker's `action` at all: the work is written where the press is, so
its callback already has everything around it.

```jsx
<Picker variant="icon" rightSlotIcon={<DisketteSvg />}>
  <Form
    action={async (fields) => {
      const created = await USERS.POST(fields);
      replaceGuest(guest, created); // the row is right here
    }}
  >
    …
  </Form>
</Picker>
```

Nothing travels back, because nothing left. This is the difference a shared
dialog hides: a popup written once, far from every press that opens it, has to
be told what it is about and has to answer somebody — and neither question
exists once the popup is written where it is used.

### A trigger that is only an icon

`variant="icon"` draws no value, and therefore no slot beside one either: the
whole trigger is its `ui`.

```jsx
<Picker variant="icon" ui={<DisketteSvg />} />
```

Left out, that `ui` is the icon the slot would have shown — the chevron, or the
one the picker's type carries (a pencil for `type="text"`, a calendar for
`type="date"`), so `<Picker type="date" variant="icon" />` is a calendar and
nothing else. `rightSlotIcon`/`rightSlot` belong to the shapes that DO draw a
value and want something beside it; under `variant="icon"` the first is only the
default for `ui`, and the second has nowhere to go — the clear cross included.

### When a shared popup is still the right answer

Two cases, and only two:

- **the press can come from anywhere** — a keyboard shortcut, a menu, a button,
  all opening the same thing. Written per press it would exist several times
  over, each with its own open state;
- **the popup has to outlive its trigger** — a row that leaves while its dialog
  is open (a list refreshing under it) takes a popup written inside it with it.

Neither is "one popup per row of a list", which is what a picker is for.

Do not mix the two. A `<Form>` at the root of a picker's popup IS the mirrored
control, so its value is the picker's value: handing the picker something else
(a created profile, say) pushes it back down into the form's named fields and
comes back as the form's aggregate. When the popup does work, let the work keep
its result.

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

A button that carries both runs them in that order: the action first, the
command once it succeeded.

```jsx
// Stays open while save() runs, closes when it resolves, stays open if it
// throws — with what was typed still there and the error on the button.
<Button command="--navi-close" commandfor="note-dialog" action={save}>
  Save
</Button>
```

The command is what the press means AFTER the work, so it waits for the work:
closing first would take the form off the screen over a request that can still
fail, and the error callout it raises would land on a button nobody can see any
more. An action that ends in an error or an abort — a `confirm` answered "no" is
an abort — leaves the popup where it is. Same rule a form already follows for
what comes after its send (`data-after-send`, see `resolveAfterSend` in
commands.js).

The wait is why closing **from inside** the action still does not close: while
the action runs, the button that started it is busy, and a busy control is
exactly what a popup refuses to close over (see the top of this page). The
refusal is not silent — the busy control raises a callout saying so — but the
popup stays open, and the first Escape afterwards dismisses that callout rather
than the popup, which reads as a popup that no longer closes at all. Nothing has
to be hand-written to work around it: `command` next to `action` is that
workaround, done at the one moment where the action has settled and the button
is no longer busy.

To close on the press instead — the answer taken as soon as it is given, the
save running on its own behind a closed popup — close from somewhere the action
does not hold up, e.g. an `onClick` of your own. Know what it costs: **a save
that fails does so behind a closed popup**.

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

## When the app holds the open state

A popup whose being-open is a fact about the application rather than about the
user's last gesture — a sheet an address can be reloaded into, an error the app
decides to show — needs somewhere to keep that fact. Three props say it, and
what separates them is where the state lives, not how hard the popup is driven:
all three go through the same `requestClose`, so a busy control inside still
refuses to be left mid-action. What changes is whether anyone hears the refusal.

### `signal` — the app holds it, both ways

```jsx
<Dialog signal={groupSheetOpenSignal} />
```

The popup opens and closes to match the signal, and writes into it whenever it
opens or closes on its own: Escape, the backdrop, a `--navi-close` command — and
the close a busy control denied, after which the signal says "open", because
that is what is true. One binding both drives the popup and knows where it is,
which is what every navi control does with its value (see
[state_binding.md](./state_binding.md)); `Dialog`, `Popover` and what is built
on them (`SidePanel`) all take it. A signal already `true` at mount means the
popup was already open when the page appeared: no entrance plays.

### `navState` — the history entry holds it

```jsx
<Dialog id="group-sheet" navState={{ type: "push" }} />
```

The open state goes into the history entry, so a screen left and come back to
finds the popup as it was, and so does a reload. `true` stores it under the
popup's own `id`; a string names the key instead. `{ type: "push" }` makes the
opening an entry of its own — the back button then closes the popup rather than
leaving the screen, and the cancel takes back with it whatever was written to
the url while it was open. A `Picker` needs none of this: its popup's open state
is nav state by construction.

The two meet when the signal IS a route's: a search-param `stateSignal` given to
`signal` puts the open state in the address itself, where a link can point at
it. That is also the shape a popup takes when it is a LAYER over the screen —
settings opened from every screen and closed back onto the one the reader was on
— and what the address may and may not claim there is a decision of its own:
[navigation.md](./navigation.md#a-layer-over-the-screen-what-its-address-may-say).

### `open`, and what it costs

`open` is the one-way half of `signal` — the parent re-renders with a boolean
and the popup follows — and the refusal is what it costs. `open={false}` goes
through the same `requestClose`, and when a busy control denies it, the parent's
state says closed while the popup stayed open. The two disagree from then on:
the effect only reacts to `open` _changing_, so setting it back to `true`
matches the popup's real state and does nothing, and the popup can no longer be
closed by the prop at all until it closes on its own. A `signal` has no such
gap, since the popup writes back what really happened.

`defaultOpen` is the middle ground: mount-only, and the popup owns everything
afterwards. `defaultOpen="interaction"` means the mount _is_ the opening (the
entrance animation plays); any other truthy value means it was already open when
the page appeared (no entrance).

## A popup that loads data

Being open is where the user is, and what a popup draws belongs to the screen
exactly the way a page's own data does. So a popup that loads something binds
its open state (above) and asks for its data with a `routeAction` whose params
are `false` while it is closed:

```js
const groupSheetOpenSignal = stateSignal(false, {
  id: "group_sheet",
  type: "boolean",
});

export const GROUP_MEMBERS = routeAction(GAME_ROUTE, USER.GET_MANY, () => {
  if (!groupSheetOpenSignal.value) {
    return false;
  }
  return { group: groupSignal.value };
});
```

```jsx
<Dialog signal={groupSheetOpenSignal}>
  <GroupMembers />
</Dialog>;

const GroupMembers = () => {
  const [members] = useAsyncData(GROUP_MEMBERS); // reads, never runs
  …
};
```

**A popup that waits holds its own `<Loading>`**, like every other part of a
screen that can wait — it is not built into `Dialog`/`Popover`, because only the
code inside knows whether anything in there loads at all:

```jsx
<Dialog signal={groupSheetOpenSignal}>
  <Loading fallback={<GroupMembersSkeleton />}>
    <GroupMembers />
  </Loading>
</Dialog>
```

Without it the nearest boundary is one that holds the popup itself, and what
happens then is worth knowing because nothing says it: the request goes out and
**the popup does not open at all** — no fallback drawn, no error raised. A
boundary waiting on an update keeps the page as it was, as a copy; the popup
being opened is part of that copy, so `showModal()` reaches a node the app no
longer owns, and once the data is there the subtree is rebuilt from scratch —
closed, and empty. The press is simply lost, and the next one works. In dev the popup says so
rather than leaving it to be guessed. The alternative is the component drawing its
own wait (`useAsyncData(action, { loading: true })`), which needs no boundary of
its own; what is not an option is neither of the two.

Both, and what each one looks like, are on
`src/layout/demos/13_popup_loading_demo.html`.

What the popup gains is everything a page has:

- the request leaves **with the screen**, in parallel with the rest of what the
  address needs, instead of behind the gesture that opens the popup;
- `useAsyncData` reads it — the wait delegated to `<Loading>`, the failure to
  `<ErrorBoundary>`, `onLoad` for what is seeded once (see
  [actions.md](./actions.md#reading-an-action));
- the action layer's rerun rules, its dependencies
  ([resource_dependencies.md](./resource_dependencies.md)) and the
  aborted-not-reset treatment a route action gets when the screen is left
  ([offline.md](./offline.md));
- a reload keeps the open state, so it keeps the request too;
- and the routes keep saying what an address needs, which is why they declare
  it.

The fallback — the popup owning its request, `useAsyncData(action, { run: true })`
— is for the parameter chosen inside the popup and dying with it: a filter the
sheet itself holds and nothing else remembers. It cannot do better than the
gesture that opened the popup, since it starts with the component that draws it;
a route action left with the screen. Hand-written (`bindParams` in the component,
`run()` from a `useEffect`, `data === undefined` as the loading flag) it looks
harmless, and that is the problem: nothing at the call site says which of the two
it is, so the day the parameter comes from the address, screen data has quietly
become a popup's private request — asked for late, and asked for alone.

## What the popup holds while it is closed

A closed popup builds nothing: `children` are mounted on the first open, and
stay mounted afterwards — a reopened popup finds its scroll position and its
half-typed form where it left them.

"Closed" is two states, not one — never opened yet, and closed again after an
opening — so the `mount` prop answers both at once:

| `mount`                       | before the first open | after a close |
| ----------------------------- | --------------------- | ------------- |
| `"always"`                    | mounted               | mounted       |
| `"from-first-open"` (default) | not mounted           | mounted       |
| `"while-opened"`              | not mounted           | not mounted   |

`"always"` is for content something depends on before any opening: a value read
off it, fields a surrounding form submits, a size measured from outside.

`"while-opened"` is what an uncontrolled field seeded from a `defaultValue`
needs: without it, a popup reopened after the underlying value changed still
shows what it showed at closing time.

```jsx
<Dialog ref={dialogRef} mount="while-opened">
  <Textarea defaultValue={note.text} />
</Dialog>
```

The content is dropped only once the exit transition is over, so the popup never
plays it on a blank surface; a popup reopened while it was leaving keeps the
content that opening just asked for.
