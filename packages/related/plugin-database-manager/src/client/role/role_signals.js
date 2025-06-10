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

export const useRoleDatabases = (role) => {
  const { databases } = role;
  const databaseIdArray = databases
    ? databases.map((database) => database.oid)
    : [];
  const databaseArray = databaseStore.selectAll(databaseIdArray);
  return databaseArray;
};
export const setRoleDatabases = (rolname, value) => {
  roleStore.upsert("rolname", rolname, { databases: value });
  databaseStore.upsert(value);
};

export const setRoleTables = (rolname, value) => {
  roleStore.upsert("rolname", rolname, { tables: value });
  tableStore.upsert(value);
};
export const useRoleTables = (role) => {
  const { tables } = role;
  const tableNameArray = tables ? tables.map((table) => table.tablename) : [];
  const tableArray = tableStore.selectAll(tableNameArray);
  return tableArray;
};

export const setRoleMembers = (role, value) => {
  roleStore.upsert(value);
  roleStore.upsert(role, { members: value });
};
export const useRoleMemberList = (role) => {
  const { members } = role;
  const memberIdArray = members ? members.map((member) => member.oid) : [];
  const memberArray = roleStore.selectAll(memberIdArray);
  return memberArray;
};
export const addMember = (role, member) => {
  const { members } = role;
  if (!members) {
    roleStore.upsert(role, { members: [member] });
    return;
  }
  for (const existingMember of members) {
    if (existingMember.oid === member.oid) {
      return; // already a member
    }
  }
  roleStore.upsert(member);
  members.push(member);
};
