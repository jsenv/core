import { registerRoute } from "@jsenv/router";
import { errorFromResponse } from "../../error_from_response.js";
import { setRoleTables } from "../role_signals.js";

export const GET_ROLE_TABLES_ROUTE = registerRoute(
  "/roles/:rolname/tables",
  async ({ params, signal }) => {
    const rolname = params.rolname;
    const response = await fetch(
      `${window.DB_MANAGER_CONFIG.apiUrl}/roles/${rolname}/tables`,
      {
        signal,
      },
    );
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get role tables");
    }
    const { data } = await response.json();
    setRoleTables(rolname, data);
  },
);
