import { useRouteUrl } from "@jsenv/router";
import { LinkWithIcon } from "../components/link_with_icon.jsx";
import { DatabaseSvg } from "./database_icons.jsx";
import { GET_DATABASE_ROUTE } from "./database_routes.js";
import { useCurrentDatabase } from "./database_signals.js";

export const DatabaseLink = ({ database, children, ...rest }) => {
  const datname = database.datname;
  const databaseRouteUrl = useRouteUrl(GET_DATABASE_ROUTE, { datname });
  const currentDatabase = useCurrentDatabase();
  const isCurrent = currentDatabase && datname === currentDatabase.datname;

  return (
    <LinkWithIcon
      icon={<DatabaseSvg color="#333" />}
      isCurrent={isCurrent}
      href={databaseRouteUrl}
      {...rest}
    >
      {children}
    </LinkWithIcon>
  );
};
