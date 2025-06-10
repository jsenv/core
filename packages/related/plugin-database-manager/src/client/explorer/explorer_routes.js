import { effect } from "@preact/signals";
import { setDatabaseCount } from "../database/database_signals.js";
import { setRoleCanLoginCount } from "../role/role_can_login/role_can_login_signals.js";
import { setRoleGroupCount } from "../role/role_group/role_group_signals.js";
import { setRoleWithOwnershipCount } from "../role/role_with_ownership/role_with_ownership_signals.js";
import { setTableCount } from "../table/table_signals.js";

effect(async () => {
  const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/explorer`);
  const { tableCount, databaseCount, roleCounts } = await response.json();
  setTableCount(tableCount);
  setDatabaseCount(databaseCount);

  const { canLoginCount, groupCount, withOwnershipCount } = roleCounts;
  setRoleCanLoginCount(canLoginCount);
  setRoleGroupCount(groupCount);
  setRoleWithOwnershipCount(withOwnershipCount);
});
