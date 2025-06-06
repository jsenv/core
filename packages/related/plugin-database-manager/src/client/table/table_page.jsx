import {
  ErrorBoundaryContext,
  Route,
  SPADeleteButton,
  useRouteParam,
} from "@jsenv/router";
import { useErrorBoundary } from "preact/hooks";
import { DatabaseValue } from "../components/database_value.jsx";
import { PageBody, PageHead } from "../layout/page.jsx";
import { RoleLink } from "../role/role_link.jsx";
import { useRoleByName } from "../role/role_signals.js";
import { TableSvg } from "./table_icons.jsx";
import {
  DELETE_TABLE_ACTION,
  GET_TABLE_ROUTE,
  PUT_TABLE_ACTION,
} from "./table_routes.js";
import { useActiveTableColumns, useTable } from "./table_signals.js";

export const TableRoutes = () => {
  return (
    <Route
      route={GET_TABLE_ROUTE}
      renderLoaded={() => <TablePage />}
      renderError={({ error }) => <TablePage routeError={error} />}
    />
  );
};

const TablePage = ({ routeError }) => {
  const [error, resetError] = useErrorBoundary();
  const tablename = useRouteParam(GET_TABLE_ROUTE, "tablename");
  const deleteTableAction = DELETE_TABLE_ACTION.bindParams({ tablename });
  const table = useTable(tablename);

  return (
    <ErrorBoundaryContext.Provider value={resetError}>
      <PageHead
        actions={[
          {
            component: (
              <SPADeleteButton
                action={deleteTableAction}
                disabled={error || routeError}
              >
                Delete
              </SPADeleteButton>
            ),
          },
        ]}
      >
        <PageHead.Label icon={<TableSvg />} label={"Tables:"}>
          {tablename}
        </PageHead.Label>
      </PageHead>
      <PageBody>
        {routeError ? (
          <ErrorDetails error={routeError} />
        ) : (
          <>
            <TableFields table={table} />
            <a
              href="https://www.postgresql.org/docs/14/ddl-basics.html"
              target="_blank"
            >
              TABLE documentation
            </a>
          </>
        )}
      </PageBody>
    </ErrorBoundaryContext.Provider>
  );
};

const ErrorDetails = ({ error }) => {
  return (
    <details className="route_error">
      <summary>{error.message}</summary>
      <pre>
        <code>{error.stack}</code>
      </pre>
    </details>
  );
};

const TableFields = ({ table }) => {
  const columns = useActiveTableColumns();
  const ownerRolname = table.tableowner;
  const ownerRole = useRoleByName(ownerRolname);

  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });

  return (
    <ul>
      {columns.map((column) => {
        const columnName = column.column_name;
        const value = table ? table[columnName] : "";
        const action = PUT_TABLE_ACTION.bindParams({
          tablename: table.tablename,
          columnName,
        });

        if (columnName === "tableowner") {
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
