import { signal, effect, computed } from "@preact/signals";
import { randomUUID } from "node:crypto";

const arraySignalStore = (arraySignal, idPropertyName = "id") => {
  effect(() => {
    const array = arraySignal.value;
    for (const object of array) {
      if (!object.__id__) {
        object.__id__ = randomUUID();
      }
    }
  });

  const currentItemIdSignal = signal(null);
  const currentItemSignal = computed(() => {
    const currentItemId = currentItemIdSignal.value;
    const array = arraySignal.value;
    if (!currentItemId) {
      return null;
    }
    for (const item of array) {
      if (item.__id__ === currentItemId) {
        return item;
      }
    }
    return null;
  });
  const setCurrentItem = (item) => {
    const id = item[idPropertyName];
    const existingItem = arraySignal.value.find(
      (itemCandidate) => itemCandidate[idPropertyName] === id,
    );
    if (existingItem) {
      currentItemIdSignal.value = existingItem.__id__;
    } else {
      item.__id__ = randomUUID();
      arraySignal.value.push(item);
    }
  };
  const onItemPropertyChange = (itemSignal, propertyName, callback) => {
    const NOT_FOUND = {};
    const propertyValueSignal = computed(() => {
      // eslint-disable-next-line no-unused-expressions
      arraySignal.value; // register array signal as dependency
      const item = itemSignal.value;
      return item ? item[propertyName] : NOT_FOUND;
    });
    const propertyValuePreviousSignal = signal(propertyValueSignal.value);
    return effect(() => {
      const propertyValuePrevious = propertyValuePreviousSignal.value;
      const propertyValue = propertyValueSignal.value;
      propertyValuePreviousSignal.value = propertyValue;
      if (
        propertyValue !== propertyValuePrevious &&
        propertyValue !== NOT_FOUND &&
        propertyValuePrevious !== NOT_FOUND
      ) {
        callback(propertyValuePrevious, propertyValue);
      }
    });
  };
  const onItemRemoved = (itemSignal, callback) => {
    const itemPreviousSignal = signal(itemSignal.value);
    return effect(() => {
      const item = itemSignal.value;
      const itemPrevious = itemPreviousSignal.value;
      itemPreviousSignal.value = itemPrevious;
      if (itemPrevious && !item) {
        callback(itemPrevious);
      }
    });
  };

  const upsertMany = (items) => {
    const array = arraySignal.peek();
    if (array.length === 0) {
      arraySignal.value = items;
      return;
    }
    const arrayUpdated = [];
    const existingItemMap = new Map();
    for (const existingItem of array) {
      arrayUpdated.push(existingItem);
      existingItemMap.set(existingItem[idPropertyName], existingItem);
    }
    for (const item of items) {
      const existingItem = existingItemMap.get(item[idPropertyName]);
      if (existingItem) {
        Object.assign(existingItem, item);
      } else {
        arrayUpdated.push(item);
      }
    }
    arraySignal.value = arrayUpdated;
  };
  const upsertOne = (id, props) => {
    const array = arraySignal.peek();
    let found = false;
    const arrayUpdated = [];
    for (const existingItem of array) {
      if (existingItem[idPropertyName] === id) {
        found = true;
        Object.assign(existingItem, props);
        arrayUpdated.push(existingItem);
      } else {
        arrayUpdated.push(existingItem);
      }
    }
    if (!found) {
      arrayUpdated.push(props);
    }
    arraySignal.value = arrayUpdated;
  };
  const removeOne = (id) => {
    const array = arraySignal.peek();
    const arrayWithoutThisOne = [];
    let found = false;
    for (const existingItem of array) {
      if (existingItem[idPropertyName] === id) {
        found = true;
      } else {
        arrayWithoutThisOne.push(existingItem);
      }
    }
    if (found) {
      arraySignal.value = arrayWithoutThisOne;
    }
  };

  return {
    currentItemSignal,
    setCurrentItem,
    onItemPropertyChange,
    onItemRemoved,
    upsertMany,
    upsertOne,
    removeOne,
  };
};

const listSignal = signal([
  {
    name: "a",
  },
  {
    name: "b",
  },
]);
const arrayStore = arraySignalStore(listSignal, "name");

arrayStore.setCurrentItem({ name: "a" });

detect_renaming: {
  arrayStore.onItemPropertyChange(
    arrayStore.currentItemSignal,
    "name",
    (from, to) => {
      console.log(`renamed from ${from} to ${to}`);
    },
  );
  arrayStore.upsertOne("a", { name: "a_renamed" });
}

detect_deletion: {
  arrayStore.onItemRemoved(arrayStore.currentItemSignal, (item) => {
    console.log(`deleted ${item.name}`);
  });
  arrayStore.removeOne("a_renamed");
}
