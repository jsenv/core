/* eslint-disable import-x/first */
const role = resource("role");
const table = resource("table");

const tableOwner = table.one(role, "owner");
const roleTables = role.many(table, "tables");
const getRoleTables = roleTables.get(async () => {
  // fetch /:rolename/tables
});

// "members" is the equivalent of "groups" but from the perspective the role grouping other roles
const roleMembers = role.many(role, "members");
const getMembers = roleMembers.get(async ({ roleId }) => {
  // fetch /:roleId/members
});
const addMember = roleMembers.put(async ({ roleId, memberId }) => {
  // put /:roleId/members/:memberId
});
const removeMember = roleMembers.delete(async ({ roleId, memberId }) => {
  // delete /:roleId/members/:memberId
});
// "groups" is the equivalent of "members" but from the perspective of a role
const roleGroups = role.many(role, "groups");
const getGroups = roleMembers.get(async ({ roleId }) => {
  // fetch /:roleId/groups
});
const joinGroup = roleGroups.put(async ({ roleId, groupId }) => {
  // put /:roleId/groups/:groupId
});
const leaveGroup = roleGroups.delete(async ({ roleId, groupId }) => {
  // delete /:roleId/groups/:groupId
});

// now the implementation:
import { computed, signal } from "@preact/signals";
import { registerAction } from "./actions.js";
import { arraySignalStore } from "./array_signal_store.js";

const resource = (name, { idKey = "id", isCollection } = {}) => {
  const collectionPropertyMap = new Map();
  const store = arraySignalStore([], idKey);

  const useCollection = () => {
    return store.arraySignal.value;
  };
  const useById = (id) => {
    return store.select(idKey, id);
  };
  const activeResourceIdSignal = signal(null);
  const useActiveResource = () => {
    const activeResourceId = activeResourceIdSignal.value;
    const activeResource = store.select(activeResourceId);
    return activeResource;
  };
  const setActiveResource = (props) => {
    const resource = store.upsert(props);
    activeResourceIdSignal.value = resource[idKey];
  };

  const addAction = (callback) => {
    const action = registerAction(callback);
    return action;
  };

  return {
    name,
    store,

    useCollection,
    useById,
    useActiveResource,
    setActiveResource,

    many: (resource, propertyName) => {
      collectionPropertyMap.set(propertyName, resource);
      const collection = resource(name, { isCollection: true });

      //   export const setRoleMembers = (role, value) => {
      //     roleStore.upsert(value);
      //     roleStore.upsert(role, { members: value });
      //   };
      //   export const useRoleMemberList = (role) => {
      //     const { members } = role;
      //     const memberIdArray = members
      //       ? members.map((member) => member.oid)
      //       : [];
      //     const memberArray = roleStore.selectAll(memberIdArray);
      //     return memberArray;
      //   };
      //   export const addMember = (role, member) => {
      //     const { members } = role;
      //     if (!members) {
      //       roleStore.upsert(role, { members: [member] });
      //       return;
      //     }
      //     for (const existingMember of members) {
      //       if (existingMember.oid === member.oid) {
      //         return; // already a member
      //       }
      //     }
      //     roleStore.upsert(member);
      //     roleStore.upsert(role, { members: [...members, member] });
      //   };
      //   export const removeMember = (role, member) => {
      //     const { members } = role;
      //     if (!members) {
      //       return; // no members to remove
      //     }
      //     const index = members.findIndex(
      //       (existingMember) => existingMember.oid === member.oid,
      //     );
      //     let found = false;
      //     const membersWithoutThisOne = [];
      //     for (const existingMember of members) {
      //       if (existingMember.oid === member.oid) {
      //         found = true;
      //       } else {
      //         membersWithoutThisOne.push(existingMember);
      //       }
      //     }
      //     if (found) {
      //       members.splice(index, 1);
      //       roleStore.upsert(role, { members: membersWithoutThisOne });
      //     }
      //   };

      return collection;
    },
    get: (callback) => {
      const getAction = addAction(async (params) => {
        const propsOrPropsArray = await callback(params);
        // lors du uprset il faut potentiellement injecter ce qu'on trouve dans les collectionPropertyMap
        const itemOrItemArray = store.upsert(propsOrPropsArray);
        return itemOrItemArray;
      });
      if (!isCollection) {
        connectStoreAndGetAction(
          store,
          activeResourceIdSignal,
          getAction,
          idKey,
        );
      }
      return getAction;
    },
    put: (callback) => {
      return addAction(async (params) => {
        const propsOrPropsArray = await callback(params);
        const itemOrItemArray = store.upsert(propsOrPropsArray);
        return itemOrItemArray;
      });
    },
    delete: (callback) => {
      return addAction(async (params) => {
        const itemIdOrItemIdArray = await callback(params);
        store.drop(itemIdOrItemIdArray);
      });
    },
  };
};

const connectStoreAndGetAction = (
  store,
  activeResourceIdSignal,
  action,
  key,
) => {
  const activeItemSignal = computed(() => {
    const activeResourceId = activeResourceIdSignal.value;
    return store.select(activeResourceId);
  });
  store.registerPropertyLifecycle(activeItemSignal, key, {
    changed: (value) => {
      action.replaceParams({
        [key]: value,
      });
    },
    dropped: () => {
      action.reload();
    },
    reinserted: () => {
      // this will reload all routes which works but
      // - most of the time only "route" is impacted, any other route could stay as is
      // - we already have the data, reloading the route will refetch the backend which is unnecessary
      // we could just remove routing error (which is cause by 404 likely)
      // to actually let the data be displayed
      // because they are available, but in reality the route has no data
      // because the fetch failed
      // so conceptually reloading is fine,
      // the only thing that bothers me a little is that it reloads all routes
      action.reload();
    },
  });
};
