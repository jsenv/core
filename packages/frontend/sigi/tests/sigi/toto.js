import { signal, effect, computed } from "@preact/signals";
import { randomUUID } from "node:crypto";

const arraySignalStore = (initialItems = [], idPropertyName = "id") => {
  const initialArray = [];
  for (const props of initialItems) {
    initialArray.push({
      __id__: randomUUID(),
      ...props,
    });
  }
  const arraySignal = signal(initialArray);

  const currentItemIdSignal = signal(null);
  const setCurrentItem = (props) => {
    const currentItemId = props[idPropertyName];
    const item = upsertOne(currentItemId, props);
    currentItemIdSignal.value = item.__id__;
  };
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

  const upsertOne = (id, props) => {
    const array = arraySignal.peek();
    let found = false;
    const arrayUpdated = [];
    let item;
    for (const existingItem of array) {
      if (existingItem[idPropertyName] === id) {
        found = true;
        Object.assign(existingItem, props);
        arrayUpdated.push(existingItem);
        item = existingItem;
      } else {
        arrayUpdated.push(existingItem);
      }
    }
    if (!found) {
      item = {
        __id__: randomUUID(),
        ...props,
      };
      arrayUpdated.push(item);
    }
    arraySignal.value = arrayUpdated;
    return item;
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

  const upsertMany = (propsArray) => {
    const array = arraySignal.peek();
    if (array.length === 0) {
      const arrayUpdated = [];
      for (const props of propsArray) {
        arrayUpdated.push({
          __id__: randomUUID(),
          ...props,
        });
      }
      arraySignal.value = arrayUpdated;
      return arrayUpdated;
    }
    const arrayUpdated = [];
    const existingItemMap = new Map();
    for (const existingItem of array) {
      arrayUpdated.push(existingItem);
      existingItemMap.set(existingItem[idPropertyName], existingItem);
    }
    for (const props of propsArray) {
      const id = props[idPropertyName];
      const existingItem = existingItemMap.get(id);
      if (existingItem) {
        Object.assign(existingItem, props);
      } else {
        const item = {
          __id__: randomUUID(),
          ...props,
        };
        arrayUpdated.push(item);
      }
    }
    arraySignal.value = arrayUpdated;
    return arrayUpdated;
  };

  return {
    currentItemSignal,
    setCurrentItem,
    onItemPropertyChange,
    onItemRemoved,
    upsertOne,
    removeOne,
    upsertMany,
  };
};

const arrayStore = arraySignalStore(
  [
    {
      name: "a",
    },
    {
      name: "b",
    },
  ],
  "name",
);

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
