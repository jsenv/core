import { resource } from "@jsenv/navi";
import {
  setDatabaseCount,
  setRoleCounts,
  setTableCount,
} from "../database_manager_signals.js";
import { errorFromResponse } from "../error_from_response.js";

export const EXPLORER = resource("explorer", {
  GET: async (_, { signal }) => {
    const explorerApiUrl = new URL(
      `${window.DB_MANAGER_CONFIG.apiUrl}/explorer`,
    );
    const response = await fetch(explorerApiUrl, { signal });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get explorer data");
    }
    const { data } = await response.json();
    const { roleCounts, databaseCount, tableCount } = data;
    setRoleCounts(roleCounts);
    setDatabaseCount(databaseCount);
    setTableCount(tableCount);
    return {};
  },
});
