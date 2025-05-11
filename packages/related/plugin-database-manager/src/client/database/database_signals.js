import { databaseStore } from "./database_store.js";
import { roleStore } from "../role/role_store.js";

export const setDatabase = (database) => {
  databaseStore.upsert(database);
};
export const setDatabaseColumns = () => {};
export const setDatabaseOwnerRole = (database, ownerRole) => {
  roleStore.update(ownerRole);
};
