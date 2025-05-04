import { registerRoutes, setBaseUrl } from "@jsenv/router";
import { tableRoutes } from "./table/table_routes.js";
import { userRoutes } from "./user/user_routes.js";

setBaseUrl(new URL("/.internal/database/", window.location.href));

const [GET_TABLES, PUT_TABLE_PROP, GET_USER] = registerRoutes({
  ...tableRoutes,
  ...userRoutes,
});

export { GET_TABLES, GET_USER, PUT_TABLE_PROP };
