/**
 *
 */

import { ErrorBoundaryContext, Route, useAction } from "@jsenv/router";
import { useErrorBoundary } from "preact/hooks";
import { GET_ROLE_ROUTE, PUT_ROLE_ACTION } from "./role_routes.js";
import { DatabaseValue } from "../components/database_value.jsx";

export const RoleRoutes = () => {
  return <Route route={GET_ROLE_ROUTE} loaded={RolePage} />;
};

const RolePage = ({ route }) => {
  const [error, resetError] = useErrorBoundary();

  return (
    <ErrorBoundaryContext.Provider value={resetError}>
      {error && <ErrorDetails error={error} />}
      <RoleFields route={route} />
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

const RoleFields = ({ route }) => {
  const { columns, role } = route.data;
  let roleName;

  const fields = columns.map((column) => {
    const columnName = column.column_name;
    const value = role[columnName];
    if (columnName === "rolname") {
      roleName = value;
    }
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
                roleName,
                columnName,
              })}
            />
          </li>
        );
      })}
    </ul>
  );
};
