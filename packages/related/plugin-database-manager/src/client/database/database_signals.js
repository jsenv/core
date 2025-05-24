import { signal } from "@preact/signals";
import { roleStore } from "../role/role_store.js";
import { databaseStore } from "./database_store.js";

export const useDatabaseList = () => {
  return databaseStore.arraySignal.value;
};
export const useDatabase = (datname) => {
  return databaseStore.select("datname", datname);
};

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
  const ownerRoleId = activeDatabaseOwnerRoleIdSignal.value;
  const ownerRole = roleStore.select(ownerRoleId);
  return ownerRole;
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

const currentDatabaseIdSignal = signal(null);
export const useCurrentDatabase = () => {
  const currentDatabaseId = currentDatabaseIdSignal.value;
  return databaseStore.select(currentDatabaseId);
};
export const setCurrentDatabase = (database) => {
  if (database) {
    databaseStore.upsert(database);
    currentDatabaseIdSignal.value = database.oid;
  } else {
    currentDatabaseIdSignal.value = null;
  }
};
