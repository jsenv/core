/*
 * The list's registry of groups (step 08): a group is known from its wrapper's
 * render (`group()`) until its wrapper's cleanup (`dropGroup()`). Preact runs
 * that cleanup before its items', so the items leaving afterwards must not
 * bring the group back — nothing would ever drop it again, and every group a
 * list ever drew would stay, read at every notification.
 *
 * The registry is private: what creates a group record is counted from the
 * Map writes made while the groups unmount.
 */

import { snapshotTests } from "@jsenv/snapshot";

import { createListItems } from "../list_items.js";

const countGroupRecordsCreated = (callback) => {
  let created = 0;
  const setBefore = Map.prototype.set;
  // eslint-disable-next-line no-extend-native
  Map.prototype.set = function (key, value) {
    if (value && typeof value === "object" && "firstSignal" in value) {
      created++;
    }
    return setBefore.call(this, key, value);
  };
  try {
    callback();
  } finally {
    // eslint-disable-next-line no-extend-native
    Map.prototype.set = setBefore;
  }
  return created;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("groups unmounted in preact's order are not brought back", () => {
    const listItems = createListItems();
    const groups = [];
    let place = 0;
    for (let g = 0; g < 100; g++) {
      const groupId = `group_${g}`;
      const entryIds = [];
      listItems.group(groupId);
      for (let i = 0; i < 3; i++) {
        const entryId = `entry_${g}_${i}`;
        listItems.draw(entryId, {
          ownerId: "run",
          place,
          groupId,
          data: { id: `item_${place}` },
        });
        entryIds.push(entryId);
        place++;
      }
      groups.push({ groupId, entryIds });
    }
    listItems.flushSync();
    const items_before = listItems.itemsSignal.peek().length;
    const group_records_created = countGroupRecordsCreated(() => {
      for (const { groupId, entryIds } of groups) {
        // the wrapper's cleanup first, then its items'
        listItems.dropGroup(groupId);
        for (const entryId of entryIds) {
          listItems.erase(entryId);
        }
      }
      listItems.flushSync();
    });
    return {
      items_before,
      items_after: listItems.itemsSignal.peek().length,
      group_records_created,
    };
  });

  // A Suspense park runs every cleanup and the reveal renders again only what
  // changed: an entry can render in a group whose wrapper has not rendered
  // since. Nothing the list knows of stands above it there.
  test("an entry of a group the list no longer knows is first", () => {
    const listItems = createListItems();
    listItems.group("parked");
    listItems.draw("entry_a", {
      ownerId: "run",
      place: 0,
      groupId: "parked",
      data: { id: "a" },
    });
    listItems.draw("entry_b", {
      ownerId: "run",
      place: 1,
      groupId: "parked",
      data: { id: "b" },
    });
    const while_known = {
      a: listItems.isFirst("entry_a"),
      b: listItems.isFirst("entry_b"),
    };
    listItems.dropGroup("parked");
    const group_records_created = countGroupRecordsCreated(() => {
      listItems.isFirst("entry_b");
    });
    return {
      while_known,
      after_drop: { b: listItems.isFirst("entry_b") },
      group_records_created,
    };
  });
});
