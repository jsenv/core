import { signal } from "@preact/signals";
import { arraySignalStore } from "@jsenv/sigi";
import { databaseStore } from "../database/database_signals.js";

export const roleColumnsSignal = signal([]);
export const useRoleColumns = () => {
  return roleColumnsSignal.value;
};
export const setRoleColumns = (value) => {
  roleColumnsSignal.value = value;
};

const roleDatabasesSignal = signal();
export const useRoleDatabases = () => {
  const roleDatabases = roleDatabasesSignal.value;
  return roleDatabases ? databaseStore.selectAll(roleDatabases) : [];
};
export const setRoleDatabases = (value) => {
  roleDatabasesSignal.value = value;
};

export const roleStore = arraySignalStore([], "oid");
export const useRoleList = () => {
  return roleStore.arraySignal.value;
};
export const useRole = (rolname) => {
  return roleStore.select("rolname", rolname);
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
