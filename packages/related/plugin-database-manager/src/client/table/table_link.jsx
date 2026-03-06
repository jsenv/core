import { RouteLink } from "@jsenv/navi";

import { TABLE_ROUTE } from "../routes.js";
import { TableSvg } from "./table_icons.jsx";

export const TableLink = ({ table, children, ...rest }) => {
  const tablename = table.tablename;

  return (
    <RouteLink
      route={TABLE_ROUTE}
      routeParams={{ tablename }}
      startIcon={<TableSvg color="currentColor" />}
      {...rest}
    >
      {children}
    </RouteLink>
  );
};
