# Opening a popup

What opens a `Dialog` or a `Popover`, and who owns the fact that it is open.

- [The popup owns its open state](#the-popup-owns-its-open-state)
- [A button opens it: the attributes](#a-button-opens-it-the-attributes)
- [Something else opens it: `triggerNaviCommand`](#something-else-opens-it-triggernavicommand)
  - [The event is forwarded, not invented](#the-event-is-forwarded-not-invented)
  - [Opening while the finger is still down](#opening-while-the-finger-is-still-down)
- [Which element receives the command](#which-element-receives-the-command)
- [The anchor](#the-anchor)
- [Opening it ON something](#opening-it-on-something)
- [A press that opens a popup and acts on it](#a-press-that-opens-a-popup-and-acts-on-it)
- [Reacting to open and close](#reacting-to-open-and-close)
- [Escape cancels, the other gestures keep](#escape-cancels-the-other-gestures-keep)
- [The close cross](#the-close-cross)
- [When the app holds the open state](#when-the-app-holds-the-open-state)
- [A popup that loads data](#a-popup-that-loads-data)
- [What the popup holds while it is closed](#what-the-popup-holds-while-it-is-closed)

Where the focus goes once it is open is its own subject — see
[autofocus.md](./autofocus.md).

## The popup owns its open state

A `Dialog`/`Popover` with no `open` prop keeps its own open state and listens
for requests to change it. That is the default way to use one, and it buys
something a `useState` in the parent cannot give back: **a popup refuses to
close while a control inside it is mid-action**. A form that is sending holds an
answer that is neither committed nor given up. Escape, the backdrop, a close
button — all of them ask, and the busy control answers, the same way it would
answer anyone else.

A run deliberately left going — activating a service worker update, which lands
only once the browser switches over — must not hold a panel that may then never
close. It says `actionStandalone`: still busy for itself, and no popup around it
is told (see
[interactions.md](./interactions.md#the-fourth-question-whose-wait-is-it)).

Between the two sits a run that IS being waited on and may never end: a request
over a network that stopped answering settles neither way, and the popup no
longer closes until the page is reloaded. `actionAbortable` gives that hold a
release — the person waiting decides the answer is not coming, and closing is
how they say it:

```jsx
<Form action={saveScore} actionAbortable>
```

Every close request then goes through and calls the run off on the way out —
Escape, the backdrop, the cross, the phone's back gesture alike: the cancel/keep
distinction below is about the VALUE a popup holds, and once the answer is on
the wire each of them means "I want out of here". Aborting frees the client and
nothing more, so the write may have landed anyway (see
[actions.md](./actions.md#aborting-saves-resources-it-does-not-undo)): say it
where the screen can be re-opened on what is actually there, never where the
popup is the only place the outcome could be read. A popup holding one run that
may be given up on and one that may not still refuses: calling off half of them
would cost an answer and change nothing on screen.

So the question is never "should this popup be controlled?" but "what triggers
the opening?" — and, when the answer is the application rather than a gesture,
where that state lives:

| what opens it                      | how                                                    |
| ---------------------------------- | ------------------------------------------------------ |
| a button                           | `command` / `commandFor` props, no `open`              |
| a gesture, an event, a JS decision | `triggerNaviCommand(...)`, still no `open`             |
| a state the app holds              | `signal` — [below](#when-the-app-holds-the-open-state) |
| where the user is                  | `navState`, or a route `stateSignal` given to `signal` |

## A button opens it: the attributes

```jsx
<Button command="--navi-open" commandFor="note-dialog">
  Read the note
</Button>
<Dialog id="note-dialog">…</Dialog>
```

The available commands: `--navi-open`, `--navi-close`, `--navi-toggle`,
`--navi-cancel` (closes, telling the popup the close means "revert" — what Escape
says, see [below](#escape-cancels-the-other-gestures-keep)), `--navi-confirm`
(says yes, then closes). `--navi-close:all` closes every popup above the button,
nearest first; a popup that refuses to close keeps the ones above it open too. A
link that leaves is the usual case — a badge shown over a sheet, both left in
one press:

```jsx
<Link href={PLAYER_ROUTE.buildUrl({ playerId })} command="--navi-close:all">
  Profil
</Link>
```

## Something else opens it: `triggerNaviCommand`

The attributes cover more than "this button opens that dialog": `commandFor`
says to whom, `value` says what it is about, `--navi-x:argument` says how. Check
none of those is the answer before writing JS: `triggerNaviCommand` is the last
resort, for a decision rather than a press on the element carrying the
attributes — a long press, the end of a drag, a double-click, a keyboard
shortcut, a server answer, an `IntersectionObserver`. A plain `Box` has no
command wiring of its own, so its click is one too:

```jsx
import { triggerNaviCommand } from "@jsenv/navi";

const dialogRef = useRef(null);

<Box
  interactions={{
    click: (event) =>
      triggerNaviCommand(dialogRef.current, "--navi-open", event),
  }}
>
  …
</Box>
<Dialog ref={dialogRef}>…</Dialog>
```

No guard against a drag: beside a `move` on the same box, the click a drag
leaves behind is already suppressed. It is the entry point the attributes go
through — same target resolution, same events — so the popup stays uncontrolled,
and keeps its say over closing.

### The event is forwarded, not invented

`event` is what caused the decision, and it is mandatory — triggering a command
without one throws. The popup reads its chain to give the focus back and to know
whether a mousedown's click must be swallowed. So the event to pass is **the one
that is already there**, threaded down through every function between the
handler and the call:

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

Only a sequence that genuinely started on its own — a timer firing, an action
settling, a signal changing — builds one: a `CustomEvent` named after what
happened, chained (`chainEvent`) to whatever preceded it, as the
`triggerNaviCommand` JSDoc shows.

### Opening while the finger is still down

A menu opened by a `longpress` appears **during** the press that asked for it,
and the release of that press does not dismiss it, whatever the browser makes of
it afterwards (a tap ends with a synthesized `mousedown`, `mouseup` and `click`
at the place the finger left — on a backdrop that did not exist when the finger
came down). Nothing to do: the very next press outside closes the popup as
usual.

```jsx
<Row
  commandFor="row_menu"
  interactions={{
    longpress: (event) =>
      triggerNaviCommand(event.target, "--navi-open", event),
  }}
/>
```

## Which element receives the command

The first argument is the command's **source** — the element it is triggered
_from_. The target is resolved from it, in this order:

1. `commandFor="someId"` on the source (the HTML `commandfor` attribute),
2. `navi-command-target="parent-control" | "child-control"`,
3. the command's own fallback — for the popup commands, `closest("[aria-expanded]")`.

A popup carries `aria-expanded` from its first render, and `closest()` starts at
the element itself, so the popup element passed as the source resolves to that
popup — the short form above. To trigger from another element, give it a
`commandFor` pointing at the popup's `id`.

## The anchor

A popup opens on the place the open names, on the `anchor` prop when the open
names none, and on whoever asked when nothing else says. In that order:

1. **`detail.anchor`** — `triggerNaviCommand`'s `anchor` option: a statement
   about that one opening. A menu belongs at the point the press happened, and
   the press is the only thing that knows that point.
2. **the `anchor` prop** — where this popup opens when nobody says.
3. **`detail.source`** — who asked. A button therefore opens the popup on
   itself, and a popup passed as its own source is its own anchor.

A `Popover` is positioned against it; a `Dialog` only reads it for
`sizeFromAnchor` and `animation="lifting"` (see [popup_lift.md](./popup_lift.md)).
`anchorCustomEventDetail="ignore"` drops the open's side of that order — for a
popup that must never be anchored to whatever opened it (`SidePanel` does this).

## Opening it ON something

A popup that edits is never only open or closed: it is open **on** something. A
dialog that is "new radar" from the top of a list and "edit this radar" from a
row is one dialog with two modes, and the press is the only thing that knows
which one — so the press says it, with its own value:

```jsx
<Button command="--navi-open" commandFor="radar-dialog">Nouveau radar</Button>
<Button value={radar.id} command="--navi-open" commandFor="radar-dialog" />

<Dialog
  id="radar-dialog"
  mount="while-opened"
  onOpen={(e) => {
    editedRadarIdSignal.value = e.detail.value; // undefined = création
  }}
>
```

That subject travels as the command's **value**, not as an argument after a
colon (`--navi-open:radar-42`). The distinction holds across every command: an
argument says WHAT the command does — `--navi-go-to-slide:edit` needs one, "go"
without a destination is not an instruction — and `value` says what it is about.
"Open" is already a complete instruction. A JS decision says it through the same
door, and `--navi-toggle` carries it too, on the half that opens:

```js
triggerNaviCommand(dialogRef.current, "--navi-open", event, {
  value: radar.id,
});
```

### `onOpen` runs before the popup has built anything

On a `Dialog`/`Popover` the order is a guarantee, not a coincidence:

```
onOpen(openEvent)   ← the subject is decided here
children mounted    ← mount="while-opened" rebuilds them from scratch, on that subject
positioned, shown
```

So a dialog whose content is seeded once — an uncontrolled field on a
`defaultValue`, a form keyed on what it edits — reads the right thing on its
very first render, instead of mounting on the previous subject and being
corrected (a flicker at best, stale fields at worst). Only
`mount="while-opened"` makes it true every time: content kept from an earlier
opening, or warmed by a hover, is already built when `onOpen` runs (see
[what the popup holds while it is closed](#what-the-popup-holds-while-it-is-closed)).
A `Picker`'s `onOpen` is not this moment: it runs once its popup is built and
shown.

The other places one could listen are not that moment: `onnavi_command` on the
popup runs **after** the opening, so what it writes lands on a popup already
open — a real race under `mount="while-opened"`; a `navi_request_open` listener
is ordered against the popup's own handler by registration.

## A press that opens a popup and acts on it

A press that opens something and then does something with what came of it — a
"save this guest" prompt on a row, which replaces the guest once the profile
exists — is not a dialog plus a way home. It is a `Picker`: a trigger and a
popup, written where the press is.

```jsx
// one per row: the popup is written where the press is
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

What the popup needs to know travels as props, and what it does has the row in
scope: no value carried through the command, nothing read back out of an event,
nobody to answer. That is the difference a shared dialog hides — written once,
far from every press that opens it, it has to be told what it is about and has
to answer somebody. The content can still be one component used in every picker:
"the prompt exists once" is a question about components, not about the DOM.

What each row costs depends on what the picker is told. A picker told no value —
no `value`, `defaultValue` or `signal` — builds its popup at render, closed: it
reads its value off the control in there, which has to exist before anything
opens. A hundred rows is then a hundred closed popups. One heavy enough to
matter can say `mount="from-first-open"`, and the picker then knows nothing of
what that control holds until the first opening: its trigger cannot draw it, and
nothing reading the picker sees it. A picker told a value, a `type="confirm"`
and a `mode="callout"` build on the first open already.

### Composing a value, or doing work

A picker mirrors **one** control in its popup — the first one that is not a
button, a link or a control that answers for itself (`standalone`). That mirror
is what makes `<Picker><List selectable/></Picker>` work with nothing wired: the
picker's value IS the list's, both ways, and the picker's `action` runs on it
when the popup closes. That is the shape for a popup that **composes a value**.
A popup that **does work** — creates a profile, uploads a file — is the one
above: the work is written where the press is, its callback already has
everything around it, and the picker needs no `action`. Nothing travels back,
because nothing left.

**Do not mix the two.** A `<Form>` at the root of a picker's popup IS the
mirrored control, so its value is the picker's value: handing the picker
something else (a created profile, say) pushes it back down into the form's
named fields and comes back as the form's aggregate. When the popup does work,
let the work keep its result.

### The trigger wears the wait

The picker's `action` runs on the trigger, not in the popup: it is dispatched on
the close that keeps, and the popup goes while it runs. So what is still on
screen answers for the write — `aria-busy` and the loading outline on the
trigger while the request is out, the error callout on it if the server refuses,
and the value rolled back to the last accepted one (`resetOnError`, on by
default for a picker). Nobody is left mid-edit behind a closed popup, and a card
that IS the trigger (`variant="bare"`, the card as `ui`) waits as a card and is
refused as a card, wherever in the tree the sheet was written.

```jsx
<Picker
  variant="bare"
  type="object"
  mode="dialog"
  ui={<MatchCard match={match} />}
  value={match}
  action={(next) => MATCH.PATCH({ id: match.id, ...next })}
>
  <ControlGroup>
    <MatchCard match={match} editable />
    <Button command="--navi-cancel">Cancel</Button>
    <Button command="--navi-send">Save</Button>
  </ControlGroup>
</Picker>
```

A `ui` reading what the picker holds — `ui={MatchCard}` is handed `value`,
`loading` and `interactive`, an element reads them with `usePickerState()` —
shows the answer the moment the sheet leaves and takes it back on a refusal (see
[control_value.md](./control_value.md#drawing-what-a-control-holds)). Drawn from
the caller's own state, as [a settings sheet](./control_object.md#a-settings-sheet)
is, the trigger keeps showing the saved answer until that state moves: which to
draw from is whether the trigger should show the pending answer or the saved
one.

What the picker measures as "changed since open" is what its mirrored group
holds. A piece of the answer living outside the controls — a seating rearranged
by drag, kept in component state — has to be held by a control in the group too
(a named control bound to that state), or a close over it reads as nothing
changed and nothing runs.

A card in a list opens on `openOn="longpress"`, so a tap on it stays a tap. Two
pickers on one card — the score sheet inside the edit card — are one wait: the
inner one names the card as its `anchor` and says `standalone`, each wears the
other's run through `loading` (from its `onActionStart`/`onActionEnd`), the
score picker says `openWhileReadOnly={false}` (a busy picker otherwise still
opens, to be read), and the inner one's `loadingOutline="custom"` leaves one
outline. `12_picker_card_demo.html` shows all of it, lifting included
([popup_lift.md](./popup_lift.md)).

A gesture inside the sheet that is not a field — cancel the game, delete it — is
still an answer the sheet gives. A named button says which:

```jsx
<Button name="op" value="cancel" command="--navi-send">
  Cancel the game
</Button>
```

Its name and value travel with the fields, the sheet leaves on the send, and the
picker's `action` receives `{ …fields, op: "cancel" }` — worn by the trigger
like any other write, and a drawing reading `usePickerState()` can already show
the "cancelled" stamp. No button inside the popup needs an action of its own: a
run started in there would belong to a control the close takes away.

This is not `optimistic`, which is "draw no wait at all": here the wait is drawn,
on the trigger. An optimistic picker is for a write not worth showing — the card
then reads the store and says nothing until the answer lands.

The same shape with nothing to write is a **door**: a drawing that grows to be
looked at — a weather scene, a plan — and comes back. `picksNothing`, no
`action`, no `dialogSizeFromAnchor` (it opens precisely to get bigger):

```jsx
<Picker
  picksNothing
  variant="bare"
  mode="dialog"
  ui={scene}
  aria-label="Zoom"
  animation="lifting"
  popupBackgroundColor="transparent"
  popupBoxShadow="none"
>
  <Box data-lift>{scene}</Box>
</Picker>
```

A `Button` opening a `Dialog` with an `anchor` does the same and is not wrong;
what the picker removes is the id plumbing (the trigger is the anchor, the popup
is its own), and what it keeps is the day the drawing becomes editable — it is
already the thing that wears the wait. The button + shared dialog stays the
answer for
[the cases where a popup must be shared](#when-a-shared-popup-is-still-the-right-answer).

### A trigger that draws nothing, pressed from elsewhere

An object placed on a map, dragged by its own `move`, owns its press and cannot
be a picker's façade: it opens the picker itself from its `click`
(`triggerNaviCommand(pickerRef.current, "--navi-open", event, { anchor, value })`).
That picker is `variant="headless"`, which stretches to the nearest positioned
element around it: opened from something it does not sit in, it needs an element
of its own to stretch into — dropped straight into the map frame it would cover
it, and every press on the empty plan would open it.

### When a shared popup is still the right answer

Three cases, and only three:

- **the press can come from anywhere** — a keyboard shortcut, a menu, a button,
  all opening the same thing. Written per press it would exist several times
  over, each with its own open state;
- **the popup has to outlive its trigger** — a row that leaves while its dialog
  is open (a list refreshing under it) takes a popup written inside it with it;
- **the popup is about more than what was pressed** — a viewer one walks
  through, where the press only says which item it opens on. Written per item,
  each popup would have to hold the whole row to be walkable. See
  [popup_lift.md](./popup_lift.md#a-row-of-cards-one-popup-that-walks).

None of them is "one popup per row of a list", which is what a picker is for.

## Reacting to open and close

`onOpen` is called on every open (for when, see
[above](#onopen-runs-before-the-popup-has-built-anything)), and `onClose` on
every real close, with `detail.isCancel` when the close meant "revert". Neither
can veto: `onClose` is the close happening, not a request to close. The refusals
are navi's: a close over a control mid-action, and a `Picker`'s close over a
value that does not validate.

### Closing when a button also runs an action

A button that carries both runs them in that order: the action first, the
command once it succeeded (see
[actions.md](./actions.md#a-press-that-opens-something-and-waits-for-the-answer)).

```jsx
// Stays open while save() runs, closes when it resolves, stays open if it
// throws — with what was typed still there and the error on the button.
<Button command="--navi-close" commandFor="note-dialog" action={save}>
  Save
</Button>
```

Closing first would take the form off the screen over a request that can still
fail, and put its error callout on a button nobody can see; an error or an abort
— a `confirm` answered "no" is an abort — leaves the popup where it is. The
action may replace that button while it runs: what the command aims at is read
at the press, so the popup pressed in is the popup that closes, even when the
press is what emptied it.

The wait is why closing **from inside** the action does not close: while it
runs, the button that started it is busy, and a busy control is exactly what a
popup refuses to close over. The busy control raises a callout, the popup stays
open, and the first Escape afterwards dismisses that callout rather than the
popup — which reads as a popup that no longer closes at all. `command` next to
`action` is the way: it runs at the one moment the action has settled.

When what opened the popup is still on screen and should answer for the write,
the popup was a picker's all along (see
[the trigger wears the wait](#the-trigger-wears-the-wait)). For a popup nobody
stands in for, closing on the press — the save running on its own behind a
closed popup — is said on the control:

```jsx
<Form command="--navi-close" action={saveScore} optimistic resetOnError>
```

Know what `optimistic` costs: **a save that fails does so behind a closed
popup**. `resetOnError` puts the control back, and the error callout is drawn on
what surrounds the closed popup — the card it opened from, typically; what the
page shows meanwhile is the app's to draw and to take back. For a write not
worth being waited for; never for one whose refusal changes what the person
does next.

## Escape cancels, the other gestures keep

The gestures that close a popup do not all mean the same thing, and that is on
purpose:

| gesture                        | means       | who decides                                                                      |
| ------------------------------ | ----------- | -------------------------------------------------------------------------------- |
| Escape                         | cancel      | always on a `Dialog`/`Popover`; a `Picker`'s `escapeEffect="cancel"` (default)   |
| a press outside                | close, keep | `pressOutside="close"`, default of `Dialog` and `Picker` (`Popover`: `"ignore"`) |
| a close cross (`--navi-close`) | close, keep | [the cross](#the-close-cross)                                                    |
| `--navi-cancel` on a button    | cancel      | the button                                                                       |

Escape says "forget it". It is the one gesture that has meant that everywhere,
for as long as there have been dialogs, and navi keeps it that way. **A popup
that must offer a way out that KEEPS what was chosen offers it with a close
cross, or by letting the click outside close** — not by teaching Escape to say
something else.

### What "cancel" actually undoes

Cancelling is not itself an undo: it marks the close, and whoever holds a value
decides what to do with the mark.

- `Dialog` and `Popover` hold nothing, so they undo nothing: `onClose` receives
  `detail.isCancel`, and reverting is the caller's own business.
- `Picker` holds a value, so it puts back **the value it held when it opened**.
  That is what makes a picker a picker: opening one is trying something on, and
  Escape is putting it back. What the outside moved while it was open stays
  moved (see
  [control_value.md](./control_value.md#a-defaultvalue-follows-what-it-was-read-from)).

```jsx
// Escape here puts back the level the picker held at open, and the list's
// uiAction fires with that restored value — the draft goes back with it.
<Picker id="level" ui={…}>
  <List selectable multiple value={draft.levels} uiAction={…}>…</List>
</Picker>
```

### A picker that holds nothing and shows nothing

The gestures that KEEP (a click outside, a close cross) let a picker send what
it is showing: a picker sitting on a `defaultValue` holds nothing, so closing on
it untouched IS the answer ("yes, 1h30"), and the action runs. A picker used as
a **menu of gestures** — no `value`, no `defaultValue`, no signal, each row a
command — shows nothing, so there is nothing to confirm: closing it without
choosing runs no action, and only an explicit choice sends.

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

`value={undefined}` is not holding nothing: a `value` prop is held whatever is in
it, and navi puts it back after each click — the rows then appear to do nothing.
Drop the prop instead of passing it empty.

### `escapeEffect="close"`, and why it is a last resort

`escapeEffect="close"` — a `Picker` prop; a `Dialog`/`Popover` has no such
switch — makes Escape say what a click outside says. It takes away the only key
that undoes, and a popup with no way back is one people stop opening: reach for
a close cross first.

A cancel can undo the address too: under a pushed history entry — a dialog
picker with an `id`, a `navState={{ type: "push" }}` — it goes back in history,
taking with it anything written to the url while the popup was open (a route
`stateSignal`, a search param). One more reason Escape and the click outside are
not interchangeable.

## The close cross

The cross is navi's own: `<Dialog.Close />`, `<Popover.Close />`,
`<Popup.Close />` — one component under three names. The caller places it, and
nothing else; it brings the `aria-label` in the active language (`label`
overrides it) and the padding that turns a three-millimetre glyph into a target
a thumb can hit:

```jsx
<Dialog id="duration">
  <Box header flex="x" alignY="center" padding="s">
    <Box expandX>Durée de la partie</Box>
    <Dialog.Close />
  </Box>
  …
</Dialog>
```

### It is the way out, so the state around it does not reach it

**A close button written by hand refuses the press inside a read-only control.**
A read-only `Picker` still opens, to be read, and hands its popup that same
read-only. Closing writes nothing to the picker, and `<Dialog.Close />` says so
(`whenSelfInteractionsBlocked="ignore"`, see
[interactions.md](./interactions.md#where-the-zone-blocks-does-it-write-to-the-control-it-sits-in));
a `<Button command="--navi-close" />` does not, wears the read-only it was
handed, and answers a press aimed at the way out with "this action is not
available right now". The same holds for a disabled zone and for a form busy
sending: the way out of a popup is never held by the state of what the popup
belongs to. A cross that really has to be hand-written carries the claim itself:

```jsx
<Button command="--navi-close" icon whenSelfInteractionsBlocked="ignore">
  …
</Button>
```

### It asks, it does not force

Being exempt from the state around it is not being exempt from the popup's
answer. The cross sends `--navi-close`, the same close REQUEST as a click
outside — same refusals, same "close, keep": a control inside mid-action refuses
it and says why, and a `Picker` validates what its popup holds and runs its
action on the way out, an invalid value keeping it open. Hiding or disabling the
cross to hold a popup open only removes the one way out that is visible.

## When the app holds the open state

A popup whose being-open is a fact about the application rather than about the
user's last gesture — a sheet an address can be reloaded into, an error the app
decides to show — needs somewhere to keep that fact. Three props say it, and
what separates them is where the state lives: all three go through the same
close request, so a busy control inside still refuses to be left mid-action.
What changes is whether anyone hears the refusal.

### `signal` — the app holds it, both ways

```jsx
<Dialog signal={groupSheetOpenSignal} />
```

The popup opens and closes to match the signal, and writes into it whenever it
opens or closes on its own — Escape, the backdrop, a `--navi-close` — and after
a close a busy control denied, when the signal says "open" again, because that
is what is true (see [state_binding.md](./state_binding.md)). A signal already
`true` at mount means the popup was already open when the page appeared: no
entrance plays.

`value` makes the signal say WHICH popup is open, for several sharing it — one
sheet per card in a feed, with a single `?seat=<gameId>` for all of them:

```jsx
<Dialog signal={seatSheetSignal} value={game.id} />
```

Opening writes the value, closing writes `undefined`, which a state signal reads
as its default and takes out of the url. A popup is open on exactly one value:
what varies while it is open (a tab inside it) is a param of its own, see
[navigation.md](./navigation.md#places-inside-the-layer).

The other way round — ONE sheet showing whichever card the address names — is
the same signal with no `value`: anything but `false`, `null` and `undefined`
reads as open, opening writes `true` only into a signal that reads closed, and
closing writes `undefined` (`false` where it held `true`). The content reads the
id from the signal and a card's press writes it — in `onOpen` when the popup is
opened ON the card, which runs before the popup writes its own open. With the
route's search-param `stateSignal` as the signal, that is how
[a row of cards](./popup_lift.md#a-row-of-cards-one-popup-that-walks) survives
leaving the page: the address names the card, and the sheet reopens on it.

### `navState` — the history entry holds it

```jsx
<Dialog id="group-sheet" navState={{ type: "push" }} />
```

The open state goes into the history entry, so a screen left and come back to
finds the popup as it was, and so does a reload. `{ type: "push" }` makes the
opening an entry of its own: the back button closes the popup rather than
leaving the screen, and a cancel goes back with the entry
([above](#escapeeffectclose-and-why-it-is-a-last-resort)). A `Picker` needs none
of this, only an `id`: its open state is nav state under that id, pushed in
dialog mode. Without an `id` the key names one mount — the page left with the
picker open and come back to is a new mount, and the state stays in the entry
with nothing to read it (navi warns). A picker whose popup leads somewhere, a
link inside it, has an `id`.

The two meet when the signal IS a route's: a search-param `stateSignal` given to
`signal` puts the open state in the address itself, where a link can point at
it — the shape of a popup that is a LAYER over the screen, whose address is
[navigation.md](./navigation.md#a-layer-over-the-screen-what-its-address-may-say)'s
decision.

### `open`, and what it costs

`open` is the one-way half of `signal` — the parent re-renders with a boolean
and the popup follows — and the refusal is what it costs. `open={false}` asks
for the close as a cancel, and when a busy control denies it, the parent's state
says closed while the popup stayed open. The two disagree from then on: only a
_change_ of `open` is read, so setting it back to `true` matches the popup's
real state and does nothing, and nothing closes it until the prop goes to
`false` again or the popup closes on its own. A `signal` has no such gap, since
the popup writes back what really happened.

`defaultOpen` is the middle ground: mount-only, and the popup owns everything
afterwards. `defaultOpen="interaction"` means the mount _is_ the opening (the
entrance animation plays); any other truthy value means it was already open when
the page appeared (no entrance).

### One panel, fed by a slot

A board with a detail pane wants one panel that stays open as long as something
asks to be shown in it, and whose content changes from one card to the next
without closing and reopening. That is a slot: `createSlot(Renderer)` keeps the
renderer mounted whether or not anything fills it, and the panel is the
renderer. `<PanelSlot />` sits once at the board level, and so does the one
`<PanelSlotFill>`, rendered by the board with the named card's content:

```jsx
const Panel = ({ children }) => (
  <SidePanel id="error_panel" signal={openCardIdSignal} closeByPressOutside>
    {children}
  </SidePanel>
);
const [PanelSlot, PanelSlotFill] = createSlot(Panel);

const openCardId = openCardIdSignal.value;
return (
  <Box>
    {cards.map((card) => (
      <Card key={card.id} card={card} />
    ))}
    {openCardId && (
      <PanelSlotFill>
        <CardDetail key={openCardId} id={openCardId} />
      </PanelSlotFill>
    )}
    <PanelSlot />
  </Box>
);
```

Two rules hold this shape together. **One `SlotFill`, rendered where the choice
is made** — not one in each card, rendered by the card that is open: two cards
crossing are two renders, and the slot is empty between them. **The panel is
bound to the screen's state, not to `isFilled`**: `open={isFilled}` turns that
empty frame into a close, whose `onClose` then clears the state the next fill was
waiting for. Bound to the signal, the panel is open exactly while a card is
named, and its own ways out clear the signal themselves. `isFilled` stays the
right `open` for a renderer with no such state — a toolbar shown while anything
fills it.

A press on another card is not an outside press once the card names the panel
with `data-navi-popup-inside` (see
[popup_backdrop.md](./popup_backdrop.md#a-box-of-the-page-that-is-not-outside)).
The full example is `src/layout/demos/7_slot_demo.html`, "Two side-panel slots".

## A popup that loads data

Being open is where the user is, and what a popup draws belongs to the screen
exactly the way a page's own data does. So a popup that loads something binds
its open state (above) and asks for its data with a `routeAction` whose params
are `false` while it is closed — and its content reads the question itself,
without the part that says whether it is open:

```js
const groupSheetOpenSignal = stateSignal(false, {
  id: "group_sheet",
  type: "boolean",
});
export const GAME_ROUTE = route("/games/:gameId", {
  searchParams: { group_sheet: groupSheetOpenSignal },
});

// asked while the sheet is open
export const GROUP_MEMBERS = routeAction(GAME_ROUTE, USER.GET_MANY, () => {
  if (!groupSheetOpenSignal.value) {
    return false;
  }
  return { group: groupSignal.value };
});
// read by the sheet, open or closed
export const GROUP_MEMBERS_SHOWN = USER.GET_MANY.bindParams({
  group: groupSignal,
});
```

```jsx
<Dialog signal={groupSheetOpenSignal}>
  <GroupMembers />
</Dialog>;

const GroupMembers = () => {
  const [members] = useAsyncData(GROUP_MEMBERS_SHOWN); // reads, never runs
  …
};
```

The same shape when the popup is one of many — a sheet on every card, opened
from wherever the card is read: its open state says which one, the route action
reads the id straight from it, and each card's content reads the question of
its own card. Declared on the root route, since a card is not a page:

```js
const seatSheetSignal = stateSignal(undefined, {
  id: "seat",
  type: "string",
  weak: true,
});
const ANY_PAGE = route("/", { searchParams: { seat: seatSheetSignal } });

export const seatableUsersOf = (gameId) => ({ game: gameId });
export const SEATABLE_USERS = routeAction(ANY_PAGE, USER.GET_MANY, () => {
  const gameId = seatSheetSignal.value;
  return gameId ? seatableUsersOf(gameId) : false;
});
```

```jsx
<Dialog signal={seatSheetSignal} value={game.id}>
  <SeatableUsers gameId={game.id} />
</Dialog>;

const SeatableUsers = ({ gameId }) => {
  const [users] = useAsyncData(
    USER.GET_MANY.bindParams(seatableUsersOf(gameId)),
  );
  …
};
```

**The content reads its question, never the route action.** The route action's
`false` says _when_ to ask. Read by the content, the same `false` says there is
nothing to show: the list empties the moment the popup closes, and the next
opening builds it again from the top — the scroll position lost, every row
rendered again for an answer that never left the store. When the popup is one
of many it is worse: the route action follows whichever popup is open, so a
card's sheet kept mounted since an earlier opening redraws with another card's
rows each time that one opens. Closing a popup does not change what it is about.
Equal params share one instance, so the content reads the very one the route
action runs, and nothing is asked twice.

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

Without it the nearest boundary is one that holds the popup itself, and the
opening is lost: the popup does not open at all, and dev says why. The other
option is the component drawing its own wait
(`useAsyncData(action, { loading: true })`); what is not an option is neither.
Both are on `src/layout/demos/13_popup_loading_demo.html`.

What the popup gains is everything a page has: the request leaves **with the
screen**, in parallel with the rest of what the address needs, instead of behind
the gesture that opens the popup; `useAsyncData` reads it (see
[actions.md](./actions.md#reading-an-action)); the rerun rules, dependencies
([resource.md](./resource.md#dependencies-rerun-after-another-resource-writes))
and aborts of a screen left ([network_policy.md](./network_policy.md)) apply; a
reload keeps the open state, so it keeps the request too.

The popup owning its request — `useAsyncData(action, { run: true })` — is the
fallback, for a parameter chosen inside the popup and dying with it: a filter
the sheet itself holds and nothing else remembers. Hand-written, with `run()`
from a `useEffect`, nothing at the call site says which of the two it is, and
screen data quietly becomes a popup's private request — asked for late, and
alone.

## What the popup holds while it is closed

A closed `Dialog`/`Popover` builds nothing: `children` are mounted on the first
open, and stay mounted afterwards — a reopened popup finds its scroll position
and its half-typed form where it left them, as long as the data it draws does
not leave with the close. A `Picker` told no value is the exception: it builds
its popup at render (see
[above](#a-press-that-opens-a-popup-and-acts-on-it)).

A `Dialog` nobody has asked for yet is not even built. It stands in as its bare
`<dialog>` — the id a command finds, the element a press announces itself on —
and the dialog proper is built at the first request: an open, a press on what
opens it, its `signal` or `open` saying open. From then on it stays built. So a
list whose rows each hold a few dialogs (a sheet per seat, a share sheet per
card) pays one element per closed dialog at every mount, not a dialog: a row
may carry the dialogs of its own actions. It is built at once when something
needs it from the start — open at mount, a `navState`, an `anchor` (a hover
builds the content ahead of the click), or a `mount` other than the default.

"Closed" is two states, not one — never opened yet, and closed again after an
opening — so the `mount` prop answers both at once:

| `mount`                       | before the first open       | after a close |
| ----------------------------- | --------------------------- | ------------- |
| `"always"`                    | mounted                     | mounted       |
| `"idle"`                      | mounted once the page idles | mounted       |
| `"from-first-open"` (default) | not mounted                 | mounted       |
| `"while-opened"`              | not mounted                 | not mounted   |

`"always"` is for content something depends on before any opening: a value read
off it (the default of a picker told no value), fields a surrounding form
submits, a size measured from outside. `"idle"` is `"always"` minus the cost on
the render that draws the page.

Whatever the value but `"while-opened"`, intent on the anchor — a pointer
entering it, focus landing in it — builds the content ahead of the click,
`onOpen` or not. A `"while-opened"` popup is warmed only by a press on what
opens it (a `--navi-open` button, a picker's trigger when a press opens it, an
expandable's UI part), throws that content away when the press ends without
opening it — one content at a time — and is never warmed on a
`Dialog`/`Popover` with an `onOpen`: the one value where the content is always
built after `onOpen`.

`"while-opened"` is for content whose fresh state is its initial state. An
untouched field does not need it to show a new `defaultValue`: it follows one
while it holds no edit (see
[control_value.md](./control_value.md#a-defaultvalue-follows-what-it-was-read-from)).
What kept content carries into the next opening is an unsent edit, and
`"while-opened"` is what throws that away.

The content is dropped only once the exit transition is over, so the popup never
plays it on a blank surface; a popup reopened while it was leaving keeps the
content that opening just asked for.
