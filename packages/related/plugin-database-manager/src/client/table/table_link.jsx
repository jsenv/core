import { useRouteStatus } from "@jsenv/navi";
import { LinkWithIcon } from "../components/link_with_icon.jsx";
import { TABLE_ROUTE } from "../routes.js";
import { TableSvg } from "./table_icons.jsx";

export const TableLink = ({ table, children, ...rest }) => {
  const tablename = table.tablename;
  const tableUrl = TABLE_ROUTE.buildUrl({ tablename });
  const { params } = useRouteStatus(TABLE_ROUTE);
  const activeTablename = params.tablename;

  return (
    <LinkWithIcon
      icon={<TableSvg color="#333" />}
      href={tableUrl}
      active={activeTablename === tablename}
      {...rest}
    >
      {children}
    </LinkWithIcon>
  );
};
