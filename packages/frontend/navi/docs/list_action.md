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
own words ("la sélection est en cours d'enregistrement") rather than in a row's.

## On a row's control: that row waits alone

`action` on the button inside the row is a call about that row. The list is not
part of it: it holds no action, nothing about it is busy, and the other rows
stay live. Two rows can be in flight at once.

```jsx
<List selectable multiple>
  <List.Item
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
— a button given both runs its action first and lets its command follow (see
[actions.md](./actions.md)). So a refused invitation leaves the row unmarked
without anything to undo.

`selectableArea="manual"` is what makes the button the interaction surface: the
row stops claiming presses that land anywhere in it, so the only way in is the
button.

## Who draws the wait, and who answers a press

**Whatever control is on the row carries the wait and the refusal.** A button,
a checkbox, a picker — it has a place to draw a spinner and an anchor to hang a
callout on, and it is what the user pressed. The row itself is the fallback,
for a row that holds nothing but text: it draws a loading outline, swallows
presses (its buttons included) and opens the sentence itself.

That is why a selectable row does not answer a press twice. It swallows the
press so nothing inside it acts, then asks the control it carries to explain —
one callout, one sentence, the same on the pointer and on the keyboard, and the
caller's `readOnlyMessage` / `busyMessage` respected either way.

## Read-only, not loading

A row whose button is working is **not loading** — the button is. The row is in
use, and what says that is `readOnly`:

```jsx
<List.Item readOnly={pending} readOnlyMessage="Invitation en cours." />
```

`loading` on a row means the ROW is waiting on something — being added to the
list, removed from it, saved where it is (see the `loading` values on
`List.Item`). Putting it there for a control's run draws a second wait next to
the one the button is already drawing, and says the row is being changed when it
is only being used.

Give the row a `readOnlyMessage` when it is held for a reason that will pass:
the default sentence is about availability ("this option is not available"),
which is the wrong thing to say about a wait.

## Hold the rows, not the list

It is tempting to write `<List readOnly={pending}>` to keep a second row from
being pressed while one is in flight. It works, and it works by luck: the
command the button fires on success (`--navi-select`) is aimed at the list, and
a list still read-only at that moment refuses it — the call goes through and the
row is never marked, silently.

Whether it lands comes down to one tick. Clearing the flag in a `finally` clears
it before the command runs, so the selection arrives; clearing it a moment later
— a transition, a debounce, one more `await` on the way out — loses it. Nothing
on screen says which of the two you wrote.

Hold the rows instead. `readOnly` on every row is what "one at a time" looks
like, it says the same thing on screen, and it leaves the list free to take the
answer whenever the answer comes:

```jsx
<List.Item readOnly={pending !== null} />   // all of them: one at a time
<List.Item readOnly={pending.includes(name)} />  // this one: each on its own
```
