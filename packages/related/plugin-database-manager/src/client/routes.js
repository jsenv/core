import { registerRoutes } from "@jsenv/router";
import { tableRoutes } from "./table/table_routes.js";
import { userRoutes } from "./user/user_routes.js";

const [GET_TABLES, GET_USER, PUT_TABLE_PROP] = registerRoutes({
  ...tableRoutes,
  ...userRoutes,
});

export { GET_TABLES, GET_USER, PUT_TABLE_PROP };
