import {
  ErrorBoundaryContext,
  Route,
  useAction,
  SPADeleteButton,
  useRouteParam,
} from "@jsenv/router";
import { useErrorBoundary } from "preact/hooks";
import {
  GET_ROLE_ROUTE,
  PUT_ROLE_ACTION,
  DELETE_ROLE_ACTION,
} from "./role_routes.js";
import { DatabaseValue } from "../components/database_value.jsx";
import { useRoleColumns, useRole, useRoleDatabases } from "./role_signals.js";

export const RoleRoutes = () => {
  return <Route route={GET_ROLE_ROUTE} loaded={RolePage} />;
};

const RolePage = () => {
  const [error, resetError] = useErrorBoundary();
  const roleName = useRouteParam(GET_ROLE_ROUTE, "roleName");
  const deleteRoleAction = useAction(DELETE_ROLE_ACTION, { roleName });
  const role = useRole(roleName);

  return (
    <ErrorBoundaryContext.Provider value={resetError}>
      {error && <ErrorDetails error={error} />}
      <h1>{roleName}</h1>
      <RoleFields role={role} />
      <RoleDatabases />
      <SPADeleteButton action={deleteRoleAction}>Delete</SPADeleteButton>

      <a
        href="https://www.postgresql.org/docs/14/sql-alterrole.html"
        target="_blank"
      >
        ALTER ROLE documentation
      </a>
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

const RoleFields = ({ role }) => {
  const columns = useRoleColumns();

  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  const fields = columns.map((column) => {
    const columnName = column.column_name;
    const value = role ? role[columnName] : "";
    return {
      column,
      value,
    };
  });

  return (
    <ul>
      {fields.map(({ column, value }) => {
        const columnName = column.column_name;
        return (
          <li key={columnName}>
            <DatabaseValue
              label={<span>{columnName}:</span>}
              column={column}
              value={value}
              action={useAction(PUT_ROLE_ACTION, {
                roleName: role.rolname,
                columnName,
              })}
            />
          </li>
        );
      })}
    </ul>
  );
};

const RoleDatabases = () => {
  const databases = useRoleDatabases();

  return (
    <div>
      <h2>Databases</h2>
      <ul>
        {databases.map((database) => {
          const databaseName = database.datname;
          return <li key={databaseName}>{databaseName}</li>;
        })}
      </ul>
    </div>
  );
};
