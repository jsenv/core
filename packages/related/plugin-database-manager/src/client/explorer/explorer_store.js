import { resource } from "@jsenv/navi";
import { setRoleCounts } from "../database_signals.js";
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
    const { roleCounts } = data;
    setRoleCounts(roleCounts);
    return {};
  },
});
EXPLORER.GET.load();
