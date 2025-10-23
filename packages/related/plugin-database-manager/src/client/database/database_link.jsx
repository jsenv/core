import { LinkWithIcon, useRouteStatus } from "@jsenv/navi";
import { DATABASE_ROUTE } from "../routes.js";
import { DatabaseSvg } from "./database_icons.jsx";
import { useCurrentDatabase } from "./database_store.js";

export const DatabaseLink = ({ database, children, ...rest }) => {
  const datname = database.datname;
  const databaseUrl = DATABASE_ROUTE.buildUrl({ datname });
  const { params } = useRouteStatus(DATABASE_ROUTE);
  const activeDatname = params.datname;
  const currentDatabase = useCurrentDatabase();
  const isCurrent = currentDatabase && datname === currentDatabase.datname;

  return (
    <LinkWithIcon
      icon={<DatabaseSvg color="#333" />}
      isCurrent={isCurrent}
      href={databaseUrl}
      active={activeDatname === datname}
      {...rest}
    >
      {children}
    </LinkWithIcon>
  );
};
