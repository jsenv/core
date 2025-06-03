import {
  ErrorBoundaryContext,
  Route,
  SPADeleteButton,
  useAction,
  useRouteParam,
} from "@jsenv/router";
import { useErrorBoundary } from "preact/hooks";
import { DatabaseValue } from "../components/database_value.jsx";
import { PageBody, PageHead } from "../layout/page.jsx";
import { RoleLink } from "../role/role_link.jsx";
import { DatabaseSvg } from "./database_icons.jsx";
import {
  DELETE_DATABASE_ACTION,
  GET_DATABASE_ROUTE,
  PUT_DATABASE_ACTION,
} from "./database_routes.js";
import {
  useActiveDatabase,
  useActiveDatabaseColumns,
  useActiveDatabaseOwnerRole,
} from "./database_signals.js";

export const DatabaseRoutes = () => {
  return <Route route={GET_DATABASE_ROUTE} loaded={DatabasePage} />;
};

const DatabasePage = () => {
  const [error, resetError] = useErrorBoundary();
  const datname = useRouteParam(GET_DATABASE_ROUTE, "datname");
  const deleteDatabaseAction = useAction(DELETE_DATABASE_ACTION, { datname });
  const database = useActiveDatabase();

  return (
    <ErrorBoundaryContext.Provider value={resetError}>
      {error && <ErrorDetails error={error} />}
      <PageHead
        actions={[
          {
            component: (
              <SPADeleteButton action={deleteDatabaseAction}>
                Delete
              </SPADeleteButton>
            ),
          },
        ]}
      >
        <PageHead.Label icon={<DatabaseSvg />} label={"Database:"}>
          {datname}
        </PageHead.Label>
      </PageHead>
      <PageBody>
        <DatabaseFields database={database} />
        <a
          href="https://www.postgresql.org/docs/14/sql-alterdatabase.html"
          target="_blank"
        >
          ALTER DATABASE documentation
        </a>
      </PageBody>
    </ErrorBoundaryContext.Provider>
  );
};

const ErrorDetails = ({ error }) => {
  return (
    <details>
      <summary>{error.message}</summary>
      <pre>
        <code>{error.stack}</code>
      </pre>
    </details>
  );
};

const DatabaseFields = ({ database }) => {
  const columns = useActiveDatabaseColumns();
  const ownerRole = useActiveDatabaseOwnerRole();

  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });

  return (
    <ul>
      {columns.map((column) => {
        const columnName = column.column_name;
        const value = database ? database[columnName] : "";
        const action = useAction(PUT_DATABASE_ACTION, {
          datname: database.datname,
          columnName,
        });

        if (columnName === "datdba") {
          // we will display this elswhere
          return (
            <li key={columnName}>
              Owner:
              <RoleLink role={ownerRole}>{ownerRole.rolname}</RoleLink>
            </li>
          );
        }
        return (
          <li key={columnName}>
            <DatabaseValue
              label={<span>{columnName}:</span>}
              column={column}
              value={value}
              action={action}
            />
          </li>
        );
      })}
    </ul>
  );
};
