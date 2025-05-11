import { signal } from "@preact/signals";
import { roleStore } from "./role_store.js";
import { databaseStore } from "../database/database_store.js";

export const useRoleList = () => {
  return roleStore.arraySignal.value;
};
export const useRole = (rolname) => {
  return roleStore.select("rolname", rolname);
};
const activeRoleIdSignal = signal(null);
export const useActiveRole = () => {
  const activeRoleId = activeRoleIdSignal.value;
  const activeRole = roleStore.select(activeRoleId);
  return activeRole;
};
export const setActiveRole = (role) => {
  role = roleStore.upsert(role);
  activeRoleIdSignal.value = role.oid;
};
const activeRoleColumnsSignal = signal([]);
export const useActiveRoleColumns = () => {
  return activeRoleColumnsSignal.value;
};
export const setActiveRoleColumns = (value) => {
  activeRoleColumnsSignal.value = value;
};
const activeRoleDatabaseIdArraySignal = signal([]);
export const useActiveRoleDatabases = () => {
  const databaseIdArray = activeRoleDatabaseIdArraySignal.value;
  const databases = databaseStore.selectAll(databaseIdArray);
  return databases;
};
export const setActiveRoleDatabases = (databases) => {
  databases = databaseStore.upsert(databases);
  const databaseIdArray = databases.map((database) => database.oid);
  activeRoleDatabaseIdArraySignal.value = databaseIdArray;
};

const currentRoleSignal = signal(null);
export const useCurrentRole = () => {
  const currentRole = currentRoleSignal.value;
  return currentRole ? roleStore.select("oid", currentRole.oid) : null;
};
export const setCurrentRole = (value) => {
  currentRoleSignal.value = value;
  roleStore.upsert(value);
};
