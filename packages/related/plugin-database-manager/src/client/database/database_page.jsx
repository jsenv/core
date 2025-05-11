import {
  ErrorBoundaryContext,
  Route,
  useAction,
  SPADeleteButton,
  useRouteParam,
} from "@jsenv/router";
import { useErrorBoundary } from "preact/hooks";
import {
  GET_DATABASE_ROUTE,
  PUT_DATABASE_ACTION,
  DELETE_DATABASE_ACTION,
} from "./database_routes.js";
import { DatabaseValue } from "../components/database_value.jsx";
import {
  useActiveDatabase,
  useActiveDatabaseColumns,
} from "./database_signals.js";

export const DatabaseRoutes = () => {
  return <Route route={GET_DATABASE_ROUTE} loaded={DatabasePage} />;
};

const DatabasePage = () => {
  const [error, resetError] = useErrorBoundary();
  const datname = useRouteParam(GET_DATABASE_ROUTE, "datname");
  const deleteAction = useAction(DELETE_DATABASE_ACTION, { datname });
  const database = useActiveDatabase();

  return (
    <ErrorBoundaryContext.Provider value={resetError}>
      {error && <ErrorDetails error={error} />}
      <h1>{datname}</h1>
      <DatabaseFields database={database} />
      <SPADeleteButton action={deleteAction}>Delete</SPADeleteButton>

      <a
        href="https://www.postgresql.org/docs/14/sql-alterrole.html"
        target="_blank"
      >
        ALTER DATABASE documentation
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

const DatabaseFields = ({ database }) => {
  const columns = useActiveDatabaseColumns();

  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  const fields = columns.map((column) => {
    const columnName = column.column_name;
    const value = database ? database[columnName] : "";
    return {
      column,
      value,
    };
  });

  return (
    <ul>
      {fields.map(({ column, value }) => {
        const columnName = column.column_name;
        const action = useAction(PUT_DATABASE_ACTION, {
          datname: database.datname,
          columnName,
        });

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
