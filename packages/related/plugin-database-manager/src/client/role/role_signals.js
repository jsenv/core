import { signal } from "@preact/signals";
import { databaseStore } from "../database/database_store.js";
import { tableStore } from "../table/table_store.js";
import { roleStore } from "./role_store.js";

export const useRoleList = () => {
  return roleStore.arraySignal.value;
};
export const useRoleByName = (rolname) => {
  return roleStore.select("rolname", rolname);
};
export const useRoleById = (oid) => {
  return roleStore.select("oid", oid);
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
  databaseStore.upsert(databases);
  const databaseIdArray = databases.map((database) => database.oid);
  activeRoleDatabaseIdArraySignal.value = databaseIdArray;
};

const currentRoleIdSignal = signal(null);
export const useCurrentRole = () => {
  const currentRoleId = currentRoleIdSignal.value;
  return roleStore.select(currentRoleId);
};
export const setCurrentRole = (role) => {
  if (role) {
    roleStore.upsert(role);
    currentRoleIdSignal.value = role.oid;
  } else {
    currentRoleIdSignal.value = null;
  }
};
setCurrentRole(window.DB_MANAGER_CONFIG.currentRole);

export const setRoleTables = (rolname, value) => {
  roleStore.upsert("rolname", rolname, {
    tables: value,
  });
};
export const useRoleTables = (rolname) => {
  const role = roleStore.select("rolname", rolname);
  let tableIdArray;
  if (!role) {
    tableIdArray = [];
  } else {
    const tables = role.tables;
    tableIdArray = tables ? tables.map((table) => table.oid) : [];
  }
  const tableArray = tableStore.selectAll(tableIdArray);
  return tableArray;
};
