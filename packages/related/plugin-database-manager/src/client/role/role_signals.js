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
  return roleStore.select(activeRoleIdSignal.value);
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
  return databaseStore.selectAll(activeRoleDatabaseIdArraySignal.value);
};
export const setActiveRoleDatabases = (databases) => {
  databases = databaseStore.upsert(databases);
  activeRoleDatabaseIdArraySignal.value = databases.map(
    (database) => database.oid,
  );
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
