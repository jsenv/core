import { signal, effect, computed } from "@preact/signals";

const generateClientId = () => {
  return window.crypto.randomUUID();
};

const clientIdSymbol = Symbol.for("client_id");

export const arraySignalStore = (initialItems = [], idPropertyName = "id") => {
  const initialArray = [];
  for (const props of initialItems) {
    initialArray.push({
      [clientIdSymbol]: generateClientId(),
      ...props,
    });
  }
  const arraySignal = signal(initialArray);

  const getByUniquePropertyName = (id) => {
    const array = arraySignal.peek();
    for (const item of array) {
      if (item[idPropertyName] === id) {
        return item;
      }
    }
    return null;
  };
  const upsert = (...args) => {
    if (args.length === 1 && Array.isArray(args[0])) {
      const propsArray = args[0];
      const array = arraySignal.peek();
      if (array.length === 0) {
        const arrayUpdated = [];
        for (const props of propsArray) {
          arrayUpdated.push({
            [clientIdSymbol]: generateClientId(),
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
            [clientIdSymbol]: generateClientId(),
            ...props,
          };
          arrayUpdated.push(item);
        }
      }
      arraySignal.value = arrayUpdated;
      return arrayUpdated;
    }
    const array = arraySignal.peek();
    let found = false;
    const arrayUpdated = [];
    let item;
    let id;
    let props;
    if (args.length === 1) {
      props = args[0];
      id = props[idPropertyName];
    } else if (args.length === 2) {
      id = args[0];
      props = args[1];
    }
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
        [clientIdSymbol]: generateClientId(),
        ...props,
      };
      arrayUpdated.push(item);
    }
    arraySignal.value = arrayUpdated;
    return item;
  };
  const drop = (data) => {
    if (Array.isArray(data)) {
      const array = arraySignal.peek();
      const arrayWithoutDroppedItems = [];
      let someDrop = false;
      const idToRemoveSet = new Set(data);
      for (const existingItem of array) {
        const existingItemId = existingItem[idPropertyName];
        if (idToRemoveSet.has(existingItemId)) {
          someDrop = true;
          idToRemoveSet.delete(existingItemId);
        } else {
          arrayWithoutDroppedItems.push(existingItem);
        }
      }
      if (someDrop) {
        arraySignal.value = arrayWithoutDroppedItems;
      }
      return arrayWithoutDroppedItems;
    }
    const idToRemove = data;
    const array = arraySignal.peek();
    const arrayWithoutItemToDrop = [];
    let found = false;
    for (const existingItem of array) {
      if (existingItem[idPropertyName] === idToRemove) {
        found = true;
      } else {
        arrayWithoutItemToDrop.push(existingItem);
      }
    }
    if (found) {
      arraySignal.value = arrayWithoutItemToDrop;
    }
    return array;
  };

  const itemSignal = () => {
    const clientIdSignal = signal(null);
    const setItem = (props) => {
      const item = upsert(props);
      const itemClientId = item[clientIdSymbol];
      clientIdSignal.value = itemClientId;
    };
    const itemSignal = computed(() => {
      const clientId = clientIdSignal.value;
      const array = arraySignal.value;
      if (!clientId) {
        return null;
      }
      for (const item of array) {
        if (item[clientIdSymbol] === clientId) {
          return item;
        }
      }
      return null;
    });
    return [itemSignal, setItem];
  };

  const onPropertyChange = (idSignal, propertyName, callback) => {
    const NOT_FOUND = { label: "not_found" };
    const clientIdSignal = signal(null);
    effect(() => {
      const id = idSignal.value;
      const array = arraySignal.value;
      for (const item of array) {
        const itemId = item[idPropertyName];
        if (itemId === id) {
          const clientId = item[clientIdSymbol];
          clientIdSignal.value = clientId;
          break;
        }
      }
      // not found, it was likely deleted
      // but maybe it was renamed so we need
      // the other effect to be sure
    });
    const valueSignal = computed(() => {
      const clientId = clientIdSignal.value;
      const array = arraySignal.value;
      for (const item of array) {
        const itemClientId = item[clientIdSymbol];
        if (itemClientId === clientId) {
          return item[propertyName];
        }
      }
      return NOT_FOUND;
    });
    const previousValueSignal = signal(valueSignal.peek());
    return effect(() => {
      const value = valueSignal.value;
      const previousValue = previousValueSignal.peek();
      previousValueSignal.value = value;
      if (
        value !== previousValue &&
        previousValue !== NOT_FOUND &&
        value !== NOT_FOUND
      ) {
        console.log({ value, previousValue });
        callback(value, previousValue);
      }
    });
  };

  const onRenameId = (idSignal, callback) =>
    onPropertyChange(idSignal, idPropertyName, callback);
  // ici on veut par dépendre du tableau pour retrouver l'item puisqu'on va le supprimer du tableau potentiellement
  // on veut juste voir s'il est encore dans le tableau
  // on peut tout a fait garder l'item tel quel sans besoin du clientId n'est ce pas?
  // car si je renomme et supprime la version renommée ça revient au meme?
  // on a besoin des client ids pour pas confonre un rename et un delete
  // mais c'est tout en fait
  const onDeleteId = (idSignal, callback) => {
    // ici ça marche mais en fait si on trouve pas alors on retourne pas null
    // on veut laisser la valeure actuelle
    const clientIdSignal = signal(null);
    effect(() => {
      const id = idSignal.value;
      const array = arraySignal.value;
      for (const item of array) {
        const itemId = item[idPropertyName];
        if (itemId === id) {
          const clientId = item[clientIdSymbol];
          clientIdSignal.value = clientId;
          break;
        }
      }
      // not found, it was likely deleted
      // but maybe it was renamed so we need
      // the other effect to be sure
    });

    const clientIdArraySignal = computed(() => {
      const array = arraySignal.value;
      const clientIdArray = [];
      for (const item of array) {
        clientIdArray.push(item[clientIdSymbol]);
      }
      return clientIdArray;
    });
    const clientIdArrayPreviousSignal = signal([...clientIdArraySignal.value]);

    return effect(() => {
      const clientIdToTrack = clientIdSignal.value;
      const clientIdArray = clientIdArraySignal.value;
      const clientIdArrayPrevious = clientIdArrayPreviousSignal.peek();
      clientIdArrayPreviousSignal.value = [...clientIdArray];
      let foundBefore = clientIdArrayPrevious.includes(clientIdToTrack);
      if (!foundBefore) {
        return;
      }
      const foundAfter = clientIdArray.includes(clientIdToTrack);
      if (foundAfter) {
        return;
      }
      callback(clientIdToTrack);
    });
  };

  return {
    arraySignal,
    getByUniquePropertyName,
    upsert,
    drop,

    itemSignal,
    onRenameId,
    onDeleteId,
    onPropertyChange,
  };
};

// const arrayStore = arraySignalStore(
//   [
//     {
//       name: "a",
//     },
//     {
//       name: "b",
//     },
//   ],
//   "name",
// );

// arrayStore.setCurrentItem({ name: "a" });

// detect_renaming: {
//   arrayStore.onItemPropertyChange(
//     arrayStore.currentItemSignal,
//     "name",
//     (from, to) => {
//       console.log(`renamed from ${from} to ${to}`);
//     },
//   );
//   arrayStore.upsert("a", { name: "a_renamed" });
// }

// detect_deletion: {
//   arrayStore.onItemRemoved(arrayStore.currentItemSignal, (item) => {
//     console.log(`deleted ${item.name}`);
//   });
//   arrayStore.drop("a_renamed");
// }
