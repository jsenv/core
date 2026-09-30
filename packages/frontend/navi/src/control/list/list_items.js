import { batch, signal } from "@preact/signals";

// Everything the list knows about its items, in one place: how many the
// collection has and where each child's items start (the places), which
// entries are drawn and which of those mount and show (the entries), and what
// each says about itself (the items). An entry is whatever is drawn at a place
// of the list — an item, a skeleton standing in for one, a group's wrapper —
// and only the first of these is an item (see draw). Two clocks. Places and "is
// anything standing above me" answer synchronously, in the middle of a render
// pass — an entry asks about the entries before it, and those have rendered
// already. The items and the counts settle once per frame (a microtask): many
// entries change in one commit, and what reads them wants one notification.
//
// Why places are read off the walk and not off the renders: a child knows how
// many items it stands for but not what was declared before it, and it cannot
// deduce that from when it renders — a render is free to skip it. A child that
// draws from signals and whose props are all referentially === the previous
// ones does not render again (@preact/signals installs a shouldComponentUpdate
// that says so), which is what any child nobody rebuilt this frame is — and
// children numbered as they render would then slide up into the place of the
// one that was skipped. So the list names a slot for each of its children and
// declares them here, in order, before any of them renders (see
// ListDeclaredChildren). A child then takes its place BY SLOT, and the place
// is a signal: it moves when what stands before it changes — an item filtered
// out, a run taking in items, a slot added or moved — and the child follows,
// rendered again for it whether or not anything else would have rendered it.
//
// Why "first" is a signal too: only the entry itself knows, once it renders,
// that it renders nothing (filtered out by a search), and the entries after it
// may have been handed back unchanged. The first mounted entry of a scope is
// kept as a signal each of them reads; when it leaves, they are rendered again.

const UNGROUPED = Symbol("ungrouped");

export const createListItems = () => {
  const totalSignal = signal(0);
  // Bumped whenever a run takes in items. The list itself has to hear about
  // it: items arriving outside the render window change nothing it can see
  // (nothing registers, nothing is drawn), and yet they are what it may have
  // been waiting for — the item it was told to open on, for one.
  const pagesSignal = signal(0);
  // How many runs are re-reading items they already show. The list wears it as
  // an attribute: what is drawn is from before, and the app may want to say so
  // without taking anything away.
  const refreshingSignal = signal(0);
  // The slots each walk declared, in order, by the slot the walk stands in
  // (null for the list's own children). Together they are a tree: a group's
  // items live inside the group's slot.
  const slotIdsByParent = new Map();
  // Who took a place — an item, or a run of items — and how many items of the
  // collection it stands for. The place itself is a signal, see take.
  const ownerById = new Map();
  // The owners standing in each slot, in the order they took their place.
  // One, as a rule; a child that renders several items keeps them in the order
  // they first rendered, which is all it can be told.
  const ownerIdsBySlot = new Map();
  const locatorByOwner = new Map();
  // The slots as the tree reads, first to last, and where each stands in it.
  // Rebuilt once a walk has changed the tree, read to place the owners.
  const slotWalk = [];
  const rankBySlot = new Map();
  let itemTotal = 0;
  // Owners have left and the others have not been moved up yet. Done on the
  // next ask rather than on the spot: items leave many at a time (a search, a
  // list unmounting), and moving the others up once is enough.
  let placesStale = false;
  // Where the last slot holding an owner stands: an owner arriving at or after
  // it is placed at the end without going over the others — a whole first
  // render, items arriving in order, costs each item nothing but itself.
  let rankOwnedLast = -1;

  const rebuildWalk = () => {
    slotWalk.length = 0;
    rankBySlot.clear();
    const visit = (parentSlotId) => {
      const slotIds = slotIdsByParent.get(parentSlotId);
      if (!slotIds) {
        return;
      }
      for (const slotId of slotIds) {
        rankBySlot.set(slotId, slotWalk.length);
        slotWalk.push(slotId);
        visit(slotId);
      }
    };
    visit(null);
  };
  // Every place, in one go: a place is the sum of what stands before it, so
  // there is nothing to hand out one at a time. Writing a place that did not
  // change wakes nobody — a signal ignores a value equal to its own.
  const refreshPlaces = () => {
    placesStale = false;
    let index = 0;
    let rank = 0;
    rankOwnedLast = -1;
    while (rank < slotWalk.length) {
      const ownerIds = ownerIdsBySlot.get(slotWalk[rank]);
      if (ownerIds) {
        for (const ownerId of ownerIds) {
          const owner = ownerById.get(ownerId);
          owner.placeSignal.value = index;
          index += owner.itemCount;
        }
        rankOwnedLast = rank;
      }
      rank++;
    }
    itemTotal = index;
    totalSignal.value = index;
    // A run's edges are places too (see refreshFirst).
    markStale(UNGROUPED);
  };
  const addToSlot = (slotId, ownerId) => {
    const ownerIds = ownerIdsBySlot.get(slotId);
    if (ownerIds) {
      ownerIds.push(ownerId);
    } else {
      ownerIdsBySlot.set(slotId, [ownerId]);
    }
    warnIfEveryItemInOneSlot(slotId);
  };
  // Items that all stand in the same slot keep the order they first mounted
  // in: the walk is over the children the list is given, and a component
  // holding them is one child however many items it renders. Everything about
  // a place then stops following what the caller writes — a search reordering
  // the items moves nothing. Said once, and only for the shape that can be
  // nothing else: the list's whole content is one child, and several items
  // came out of it.
  let everyItemInOneSlotWarned = false;
  const warnIfEveryItemInOneSlot = (slotId) => {
    if (everyItemInOneSlotWarned) {
      return;
    }
    const rootSlotIds = slotIdsByParent.get(null);
    if (!rootSlotIds || rootSlotIds.length !== 1 || rootSlotIds[0] !== slotId) {
      return;
    }
    if (ownerIdsBySlot.get(slotId).length < 2) {
      return;
    }
    everyItemInOneSlotWarned = true;
    console.warn(
      `List: every item stands in the same slot, so they keep the order they first rendered in — reordering them (a search, a sort) will not move them. The list's items must be its own children: give it the items (or a <List.Items>), not a component rendering them.`,
    );
  };
  // A run holds the room of every item it was given, drawn or not: its
  // fillers count them, its window frames them. An item of it that renders
  // nothing leaves its room blank, where a declared item gives its place back.
  let runItemRemovedWarned = false;
  const warnRunItemRemoved = () => {
    if (runItemRemovedWarned) {
      return;
    }
    runItemRemovedWarned = true;
    console.warn(
      `List: an item drawn by <List.Items> matches nothing and searchNoMatchMode is "remove", but a run's items cannot be removed: the run keeps the room of every item it was given, so the item leaves a blank. Give <List.Items> the matching items only (useSearchText orders them first; keep the ones whose getItemMatchInfo(item).match is not false), or use searchNoMatchMode="muted" / "invisible_and_inert", which keep the item.`,
    );
  };
  const removeFromSlot = (slotId, ownerId) => {
    const ownerIds = ownerIdsBySlot.get(slotId);
    if (!ownerIds) {
      return;
    }
    const index = ownerIds.indexOf(ownerId);
    if (index !== -1) {
      ownerIds.splice(index, 1);
    }
    if (ownerIds.length === 0) {
      ownerIdsBySlot.delete(slotId);
    }
  };
  // A slot the walk no longer names: whatever stood in it is gone, and so is
  // whatever a walk inside it had declared.
  const dropSlot = (slotId) => {
    const ownerIds = ownerIdsBySlot.get(slotId);
    if (ownerIds) {
      for (const ownerId of ownerIds) {
        ownerById.delete(ownerId);
      }
      ownerIdsBySlot.delete(slotId);
    }
    const childSlotIds = slotIdsByParent.get(slotId);
    if (childSlotIds) {
      slotIdsByParent.delete(slotId);
      for (const childSlotId of childSlotIds) {
        dropSlot(childSlotId);
      }
    }
  };

  // ---- the entries drawn ----
  // entryId → { ownerId, place, groupId, data, mounted, visible, item }
  const entryById = new Map();
  // groupId → { firstSignal, countSignal, noMatchCountSignal }
  const groupById = new Map();
  // ownerId → { from, to }, for the runs (see declareWindow).
  const windowByOwner = new Map();
  // The first place something stands at, outside any group: the mounted
  // entries and the items a run holds above its window. Per group, the group's
  // first mounted entry.
  const firstStandingSignal = signal(-1);
  // The scopes whose first entry left: recounted on the next ask, or at the end
  // of the frame, whichever comes first. An entry mounting before the first one
  // moves it at once, no recount needed — the first can only ever move up.
  const staleScopes = new Set();
  const scopeOf = (groupId) => (groupId === undefined ? UNGROUPED : groupId);
  const groupOf = (groupId) => {
    let group = groupById.get(groupId);
    if (!group) {
      group = {
        firstSignal: signal(-1),
        countSignal: signal(0),
        noMatchCountSignal: signal(0),
      };
      groupById.set(groupId, group);
    }
    return group;
  };
  const firstSignalOf = (scope) =>
    scope === UNGROUPED ? firstStandingSignal : groupOf(scope).firstSignal;
  const refreshFirst = (scope) => {
    staleScopes.delete(scope);
    let first = -1;
    const consider = (place) => {
      if (place !== undefined && (first === -1 || place < first)) {
        first = place;
      }
    };
    for (const entry of entryById.values()) {
      if (entry.mounted && scopeOf(entry.groupId) === scope) {
        consider(entry.place);
      }
    }
    if (scope === UNGROUPED) {
      for (const [ownerId, window] of windowByOwner) {
        const owner = ownerById.get(ownerId);
        if (!owner) {
          continue;
        }
        const start = owner.placeSignal.peek();
        if (window.from > start) {
          consider(start);
        }
        if (window.to < start + owner.itemCount) {
          consider(window.to);
        }
      }
    }
    firstSignalOf(scope).value = first;
  };
  const markStale = (scope) => {
    if (staleScopes.has(scope)) {
      return;
    }
    staleScopes.add(scope);
    queueMicrotask(() => {
      if (staleScopes.has(scope)) {
        refreshFirst(scope);
      }
    });
  };
  const leaveFirst = (entry) => {
    const scope = scopeOf(entry.groupId);
    if (firstSignalOf(scope).peek() === entry.place) {
      markStale(scope);
    }
  };

  // ---- the items, settled once per frame ----
  const itemsSignal = signal([]);
  const visibleItemsSignal = signal([]);
  const countSignal = signal(0);
  const visibleCountSignal = signal(0);
  const noMatchCountSignal = signal(0);
  let notifyScheduled = false;
  const runNotify = () => {
    batch(() => {
      const itemEntries = [];
      for (const entry of entryById.values()) {
        if (entry.item) {
          itemEntries.push(entry);
        }
      }
      itemEntries.sort(compareEntryPlaces);
      const items = [];
      const visibleItems = [];
      let noMatchCount = 0;
      const countByGroup = new Map();
      const noMatchCountByGroup = new Map();
      const prevItems = itemsSignal.peek();
      const prevVisibleItems = visibleItemsSignal.peek();
      let itemsChanged = prevItems.length !== itemEntries.length;
      let visibleItemsChanged = false;
      for (const entry of itemEntries) {
        const item = entry.data;
        // Compared by reference: any prop change (selected, disabled, …) is a
        // new props object.
        if (!itemsChanged && item !== prevItems[items.length]) {
          itemsChanged = true;
        }
        items.push(item);
        const noMatch = item.match === false;
        if (noMatch) {
          noMatchCount++;
        }
        if (entry.groupId !== undefined) {
          countByGroup.set(
            entry.groupId,
            (countByGroup.get(entry.groupId) || 0) + 1,
          );
          if (noMatch) {
            noMatchCountByGroup.set(
              entry.groupId,
              (noMatchCountByGroup.get(entry.groupId) || 0) + 1,
            );
          }
        }
        if (entry.visible) {
          if (
            !visibleItemsChanged &&
            item !== prevVisibleItems[visibleItems.length]
          ) {
            visibleItemsChanged = true;
          }
          visibleItems.push(item);
        }
      }
      if (visibleItems.length !== prevVisibleItems.length) {
        visibleItemsChanged = true;
      }
      let someChange = false;
      if (countSignal.peek() !== items.length) {
        countSignal.value = items.length;
        someChange = true;
      }
      if (visibleCountSignal.peek() !== visibleItems.length) {
        visibleCountSignal.value = visibleItems.length;
        someChange = true;
      }
      if (itemsChanged) {
        itemsSignal.value = items;
        someChange = true;
      }
      if (visibleItemsChanged) {
        visibleItemsSignal.value = visibleItems;
        someChange = true;
      }
      if (noMatchCountSignal.peek() !== noMatchCount) {
        noMatchCountSignal.value = noMatchCount;
        someChange = true;
      }
      for (const [groupId, group] of groupById) {
        group.countSignal.value = countByGroup.get(groupId) || 0;
        group.noMatchCountSignal.value = noMatchCountByGroup.get(groupId) || 0;
      }
      if (someChange && listItems.onChange) {
        listItems.onChange();
      }
    });
  };
  const notify = () => {
    if (notifyScheduled) {
      return;
    }
    notifyScheduled = true;
    queueMicrotask(() => {
      if (!notifyScheduled) {
        return;
      }
      notifyScheduled = false;
      runNotify();
    });
  };

  const listItems = {
    totalSignal,
    pagesSignal,
    refreshingSignal,
    // The entries that are items, in place order — every one drawn, and the
    // ones that show — and what the search made of them. Written once per
    // frame.
    itemsSignal,
    visibleItemsSignal,
    countSignal,
    visibleCountSignal,
    noMatchCountSignal,
    // Called once per frame in which the items changed. Set by the list.
    onChange: null,
    // What a run needs to know about the list it lives in: how many items to
    // ask its source for at a time, which end it opens on, and how much room
    // one item is given — an item whose content has not arrived must take
    // exactly that, or the items drawn would not reach where the list says
    // they are.
    pageSize: 0,
    scrolled: "start",
    // The list is on its way somewhere: what the window frames is not what it
    // is about to frame, so a run must not fetch for it (see holdWindow).
    holdPending: false,
    // Called by a run just before items land in it: what is on screen must not
    // move because something arrived above it. Set by the list itself, with
    // what puts the view back once they have (see VirtualFiller).
    captureAnchor: () => {},
    holdViewStill: () => {},
    horizontal: false,
    virtualItemSizeSignal: null,
    renderSkeleton: undefined,
    // The children a walk stands over, in order — said in one call, before any
    // of them renders, so that what a child asks next is answered against the
    // whole picture and not against the children that happened to render
    // first. Said again on every render of the walk, and heard only when
    // something moved.
    declareSlots: (parentSlotId, slotIds) => {
      const slotIdsPrevious = slotIdsByParent.get(parentSlotId);
      if (slotIdsPrevious && sameSlotIds(slotIdsPrevious, slotIds)) {
        return;
      }
      if (slotIdsPrevious) {
        const slotIdSet = new Set(slotIds);
        for (const slotId of slotIdsPrevious) {
          if (!slotIdSet.has(slotId)) {
            dropSlot(slotId);
          }
        }
      }
      slotIdsByParent.set(parentSlotId, slotIds);
      rebuildWalk();
      refreshPlaces();
    },
    // Whether something has taken this slot for its own: what it renders
    // inside is then its to place (a run draws its groups with their items
    // already placed), and no walk inside it has anything to declare.
    slotHasOwner: (slotId) => ownerIdsBySlot.has(slotId),
    warnRunItemRemoved,
    // Whether any run of items lives in this list: what makes a render window
    // mean anything (see List's renderBudget).
    hasRuns: () => locatorByOwner.size > 0,
    setItemLocator: (ownerId, locate) => {
      locatorByOwner.set(ownerId, locate);
    },
    dropItemLocator: (ownerId) => {
      locatorByOwner.delete(ownerId);
    },
    // Where the item named by that id sits, asked of whoever holds it.
    locateItem: (id) => {
      for (const locate of locatorByOwner.values()) {
        const index = locate(id);
        if (index !== null) {
          return index;
        }
      }
      return null;
    },
    // The place the owner's items start at — read from a signal, so that the
    // owner is rendered again when it moves (see the top of this file). Asked
    // on every render, and answered without a second look for as long as the
    // owner stands in the same slot for the same number of items.
    take: (ownerId, itemCount, slotId) => {
      let owner = ownerById.get(ownerId);
      if (owner) {
        if (owner.slotId !== slotId || owner.itemCount !== itemCount) {
          removeFromSlot(owner.slotId, ownerId);
          addToSlot(slotId, ownerId);
          owner.slotId = slotId;
          owner.itemCount = itemCount;
          placesStale = true;
        }
        if (placesStale) {
          refreshPlaces();
        }
        return owner.placeSignal.value;
      }
      if (placesStale) {
        refreshPlaces();
      }
      const rank = rankBySlot.get(slotId);
      addToSlot(slotId, ownerId);
      if (rank !== undefined && rank >= rankOwnedLast) {
        owner = { slotId, itemCount, placeSignal: signal(itemTotal) };
        ownerById.set(ownerId, owner);
        itemTotal += itemCount;
        rankOwnedLast = rank;
        totalSignal.value = itemTotal;
        return owner.placeSignal.value;
      }
      owner = { slotId, itemCount, placeSignal: signal(0) };
      ownerById.set(ownerId, owner);
      refreshPlaces();
      return owner.placeSignal.value;
    },
    // The owner stands for no item of the collection: it was filtered out by a
    // search, or it is gone.
    drop: (ownerId) => {
      const owner = ownerById.get(ownerId);
      if (!owner) {
        return;
      }
      ownerById.delete(ownerId);
      removeFromSlot(owner.slotId, ownerId);
      windowByOwner.delete(ownerId);
      if (placesStale) {
        return;
      }
      placesStale = true;
      queueMicrotask(() => {
        if (placesStale) {
          refreshPlaces();
        }
      });
    },

    // ---- the entries drawn ----

    // A run says which of its items it draws. The others stand: items above
    // the window are above every entry drawn, whether or not any of the drawn
    // ones mounts (see refreshFirst).
    declareWindow: (ownerId, from, to) => {
      const window = windowByOwner.get(ownerId);
      if (window && window.from === from && window.to === to) {
        return;
      }
      windowByOwner.set(ownerId, { from, to });
      markStale(UNGROUPED);
    },
    // An entry says what it is, where it renders: its place, the group it is
    // in, and its data — from which follows whether it mounts at all (filtered
    // out), whether it shows (hidden keeps the room, not the content), and
    // whether it is an item (a group wrapper, a skeleton, are entries of the
    // list but items of nobody). Said in the name of the component, not of the
    // item id: two components may stand for one item for a moment, one leaving
    // as the other arrives.
    draw: (entryId, { ownerId, place, groupId, data }) => {
      const mounted = !data.filtered;
      const visible = mounted && !data.hidden;
      const item = !data.skeleton && data.role !== "presentation";
      let entry = entryById.get(entryId);
      if (entry) {
        if (
          entry.mounted &&
          (entry.place !== place || entry.groupId !== groupId || !mounted)
        ) {
          leaveFirst(entry);
        }
        entry.ownerId = ownerId;
        entry.place = place;
        entry.groupId = groupId;
        entry.data = data;
        entry.mounted = mounted;
        entry.visible = visible;
        entry.item = item;
      } else {
        entry = { ownerId, place, groupId, data, mounted, visible, item };
        entryById.set(entryId, entry);
      }
      if (mounted) {
        const firstSignal = firstSignalOf(scopeOf(groupId));
        const first = firstSignal.peek();
        if (first === -1 || place < first) {
          firstSignal.value = place;
        }
      }
      notify();
    },
    // The entry is gone. A declared item is its own owner and gives its place
    // back with it; a run's item leaves the run's places alone.
    erase: (entryId) => {
      const entry = entryById.get(entryId);
      if (!entry) {
        return;
      }
      entryById.delete(entryId);
      if (entry.mounted) {
        leaveFirst(entry);
      }
      if (entry.ownerId === entryId) {
        listItems.drop(entryId);
      }
      notify();
    },
    // Whether nothing of the list stands above this entry: in its group, no
    // other entry of the group mounts before it; outside groups, no entry
    // mounts before it and no run has items above its window before it.
    // Answered from a signal, so an entry rendered from a kept vnode is
    // rendered again when the entry before it leaves or comes back.
    isFirst: (entryId) => {
      const entry = entryById.get(entryId);
      const scope = scopeOf(entry.groupId);
      if (staleScopes.has(scope)) {
        refreshFirst(scope);
      }
      return firstSignalOf(scope).value === entry.place;
    },
    // What a group knows about its items: how many, and how many of them the
    // search left out (see ListItemGroup).
    group: (groupId) => groupOf(groupId),
    dropGroup: (groupId) => {
      groupById.delete(groupId);
      staleScopes.delete(groupId);
    },
    // Written when a frame's entries have settled (see notify); the value to
    // act on is peeked from wherever the change is heard.
    flushSync: () => {
      if (!notifyScheduled) {
        return;
      }
      notifyScheduled = false;
      runNotify();
    },
  };
  return listItems;
};
const sameSlotIds = (left, right) => {
  if (left.length !== right.length) {
    return false;
  }
  let index = 0;
  while (index < left.length) {
    if (left[index] !== right[index]) {
      return false;
    }
    index++;
  }
  return true;
};

// Entries in place order; an entry with no place (a declared item filtered
// out) last.
const compareEntryPlaces = (left, right) => {
  if (left.place === undefined) {
    return right.place === undefined ? 0 : 1;
  }
  if (right.place === undefined) {
    return -1;
  }
  return left.place - right.place;
};
