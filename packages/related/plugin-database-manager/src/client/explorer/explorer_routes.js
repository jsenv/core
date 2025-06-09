import { effect } from "@preact/signals";
import { setDatabaseCount } from "../database/database_signals.js";
import { setRoleCount } from "../role/role_signals.js";
import { setTableCount } from "../table/table_signals.js";

effect(async () => {
  const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/explorer`);
  const { tableCount, databaseCount, roleCount } = await response.json();
  setTableCount(tableCount);
  setDatabaseCount(databaseCount);
  setRoleCount(roleCount);
});
