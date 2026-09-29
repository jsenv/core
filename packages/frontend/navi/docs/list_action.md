# A list that acts on what it holds

Two different screens are written with the same components: a list that answers
one question (which seat, which side, which city) and a list that is a place to
act, row by row (invite this person, archive that row). They look alike and they
wait very differently, and what decides it is one thing:

**Where the action lives decides who waits.**

- [On the list: one answer, and the list waits](#on-the-list-one-answer-and-the-list-waits)
- [On a row's control: that row waits alone](#on-a-rows-control-that-row-waits-alone)
- [Who draws the wait, and who answers a press](#who-draws-the-wait-and-who-answers-a-press)
- [Read-only, not loading](#read-only-not-loading)
- [Hold the rows, not the list](#hold-the-rows-not-the-list)
- [How many at once: `parallelGuard`](#how-many-at-once-parallelguard)

Live examples: the **Button** section of
`src/control/demos/13_list_selectable_demo.html` shows both, side by side, over
a backend answered by hand.

## On the list: one answer, and the list waits

`action` on the `<List>` is the selection being sent. The list holds one value,
so there is one run, and the whole list is busy until it comes back — every row
refuses in the meantime, which is what you want when the rows are alternatives.

```jsx
<List selectable action={(seat) => putSeat(seat)}>
```

A press on another row while it runs is refused and says so, in the selection's
own words rather than in a row's.

## On a row's control: that row waits alone

`action` on the button inside the row is a call about that row. The list is not
part of it: it holds no action, nothing about it is busy, and the other rows
stay live. Two rows can be in flight at once.

```jsx
<List id="the_list" selectable multiple>
  <List.Item
    id={rowId}
    selectable
    value={person}
    readOnly={pending}
    selectableArea="manual"
  >
    <Text expandX>{person}</Text>
    <Button
      action={() => invite(person)}
      command="--navi-select"
      commandFor="the_list"
      command-value={rowId}
    >
      Invite
    </Button>
  </List.Item>
</List>
```

The command is what marks the row, and it runs **only if the action succeeded**
(see [actions.md](./actions.md#a-press-that-opens-something-and-waits-for-the-answer)),
so a refused invitation leaves the row unmarked without anything to undo.
`selectableArea="manual"` keeps the row from selecting under a press that lands
beside the button — here what marks the row is the command, once the invitation
went through; a control inside a row answers its own press whichever area the
row claims.

## Who draws the wait, and who answers a press

**Whatever control is on the row carries the wait and the refusal.** A button,
a checkbox, a picker — it has a place to draw a spinner and an anchor to hang a
callout on, and it is what the user pressed. The row itself is the fallback, for
a row that holds nothing but text: it draws a loading outline, swallows presses
(its buttons included) and opens the sentence itself.

That is why a selectable row does not answer a press twice. It swallows the
press so nothing inside it acts, then asks the control it carries to explain —
one callout, one sentence, the same on the pointer and on the keyboard, and the
caller's `readOnlyMessage` / `busyMessage` respected either way.

And it lands **where the press landed**. A row answers for a whole box, and its
own control is a visually hidden checkbox, so a sentence anchored on that would
sit in the middle of the row pointing at nothing. Pressed on the button, it
belongs on the button; pressed on the row's own surface, on the row:

| what was pressed                                | where the sentence appears |
| ----------------------------------------------- | -------------------------- |
| the button of a row whose own run is going      | the button                 |
| the name of that same row                       | the row                    |
| the button of a row held back by something else | the button                 |

The last one needs nothing special: that row is not blocked, so the press
reaches the button and the button's own gate answers it. A row that would rather
always take it says so once: `<List.Item data-callout-anchor="item" />`.

## Read-only, not loading

A row whose button is working is **not loading** — the button is. The row is in
use, and what says that is `readOnly`:

```jsx
<List.Item readOnly={pending} readOnlyMessage="Invitation en cours." />
```

`loading` on a row means the ROW is waiting on something — being added to the
list, removed from it, saved where it is (the `loading` values of `List.Item`).
Putting it there for a control's run draws a second wait next to the one the
button is already drawing, and says the row is being changed when it is only
being used.

Give the row a `readOnlyMessage` when it is held for a reason that will pass:
the default sentence is about availability ("this option is not available"),
which is the wrong thing to say about a wait.

## Hold the rows, not the list

It is tempting to write `<List readOnly={pending}>` to keep a second row from
being pressed while one is in flight, and it works by luck: the command the
button fires on success (`--navi-select`) is aimed at the list, and a list still
read-only at that moment refuses it — the call goes through and the row is never
marked, silently. Whether it lands comes down to one tick (the flag cleared in a
`finally`, or a moment later), and nothing on screen says which you wrote.

Hold the rows instead: `readOnly` on every row says the same thing on screen and
leaves the list free to take the answer whenever the answer comes.

```jsx
<List.Item readOnly={pending !== null} />   // all of them: one at a time
<List.Item readOnly={pending.includes(name)} />  // this one: each on its own
```

One at a time also needs no state of the app's: `<List parallelGuard={1}>`
holds every control that would start a run while one is out (below).

## How many at once: `parallelGuard`

Nothing about a row's own action stops someone from starting one on every row a
list draws — a dozen requests in flight because the list happened to be long. So
a list allows **four runs at once by default**. While that many are out, every
control in it that would start another run goes read-only and says how many it
is waiting on; the next press is possible again the moment one comes back.

```jsx
<List parallelGuard={2}>      // stricter
<List parallelGuard={Infinity}>  // lifted, without taking it out of the tree
```

It counts runs, not values — the whole difference from `maxLengthGuard`, which
says how many things the selection may HOLD, where this one says how many may be
HAPPENING. A list can carry either, or both, and they refuse for unrelated
reasons. Only a control that would start a run is held: a row with nothing to
run, or a button that merely fires a command, never waits its turn.
