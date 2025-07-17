import { LinkWithIcon } from "../components/link_with_icon.jsx";
import { DatabaseSvg } from "./database_icons.jsx";
// import { useCurrentDatabase } from "./database_store.js";

export const DatabaseLink = ({ database, children, ...rest }) => {
  const datname = database.datname;
  // const databaseRouteUrl = useRouteUrl(GET_DATABASE_ROUTE, { datname });
  // const databaseRouteIsMatching = useRouteIsMatching(GET_DATABASE_ROUTE, {
  //   datname,
  // });
  const databaseRouteIsMatching = false;
  // const currentDatabase = useCurrentDatabase();
  const currentDatabase = null;
  const isCurrent = currentDatabase && datname === currentDatabase.datname;

  return (
    <LinkWithIcon
      icon={<DatabaseSvg color="#333" />}
      isCurrent={isCurrent}
      href={"#"}
      data-active={databaseRouteIsMatching ? "" : undefined}
      {...rest}
    >
      {children}
    </LinkWithIcon>
  );
};
