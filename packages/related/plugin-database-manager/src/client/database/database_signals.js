import { signal } from "@preact/signals";
import { databaseStore } from "./database_store.js";
import { roleStore } from "../role/role_store.js";

const activeDatabaseIdSignal = signal(null);
const activeDatabaseColumnsSignal = signal([]);
const activeDatabaseOwnerRoleIdSignal = signal(null);
export const useActiveDatabase = () => {
  const activeDatabaseId = activeDatabaseIdSignal.value;
  const activeDatabase = databaseStore.select(activeDatabaseId);
  return activeDatabase;
};
export const useActiveDatabaseColumns = () => {
  return activeDatabaseColumnsSignal.value;
};
export const useActiveDatabaseOwnerRole = () => {
  const activeDatabaseOwnerRoleId = activeDatabaseOwnerRoleIdSignal.value;
  const activeDatabaseOwnerRole = databaseStore.select(
    activeDatabaseOwnerRoleId,
  );
  return activeDatabaseOwnerRole;
};

export const setActiveDatabase = (database) => {
  if (database) {
    databaseStore.upsert(database);
    activeDatabaseIdSignal.value = database.oid;
  } else {
    activeDatabaseIdSignal.value = null;
  }
};
export const setActiveDatabaseColumns = (columns) => {
  activeDatabaseColumnsSignal.value = columns;
};
export const setActiveDatabaseOwnerRole = (ownerRole) => {
  if (ownerRole) {
    roleStore.upsert(ownerRole);
    activeDatabaseOwnerRoleIdSignal.value = ownerRole.oid;
  } else {
    activeDatabaseOwnerRoleIdSignal.value = null;
  }
};
