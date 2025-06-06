import { useRouteUrl } from "@jsenv/router";
import { LinkWithIcon } from "../components/link_with_icon.jsx";
import { TableSvg } from "./table_icons.jsx";
import { GET_TABLE_ROUTE } from "./table_routes.js";

export const TableLink = ({ table, children, ...rest }) => {
  const tablename = table.tablename;
  const tableRouteUrl = useRouteUrl(GET_TABLE_ROUTE, { tablename });

  return (
    <LinkWithIcon
      icon={<TableSvg color="#333" />}
      href={tableRouteUrl}
      {...rest}
    >
      {children}
    </LinkWithIcon>
  );
};
