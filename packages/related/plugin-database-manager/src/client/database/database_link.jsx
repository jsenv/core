import { RouteLink } from "@jsenv/navi";

import { DATABASE_ROUTE } from "../routes.js";
import { DatabaseSvg } from "./database_icons.jsx";
import { useCurrentDatabase } from "./database_store.js";

export const DatabaseLink = ({ database, children, ...rest }) => {
  const datname = database.datname;
  const currentDatabase = useCurrentDatabase();
  const isCurrent = currentDatabase && datname === currentDatabase.datname;

  return (
    <RouteLink
      route={DATABASE_ROUTE}
      routeParams={{ datname }}
      startIcon={<DatabaseSvg />}
      {...rest}
    >
      {isCurrent && <span>(current)</span>}
      {children}
    </RouteLink>
  );
};
