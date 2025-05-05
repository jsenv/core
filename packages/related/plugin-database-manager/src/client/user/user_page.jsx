import { ErrorBoundaryContext, Route, useRouteUrl } from "@jsenv/router";
import { useErrorBoundary } from "preact/hooks";
import { GET_USER_ROUTE, PUT_USER_ROUTE } from "./user_routes.js";
import { DatabaseValue } from "../components/database_value.jsx";

export const UserRoutes = () => {
  return <Route route={GET_USER_ROUTE} loaded={UserPage} />;
};

const UserPage = ({ route }) => {
  const [error, resetError] = useErrorBoundary();
  const { columns, user } = route.data;

  const fields = columns.map((column) => {
    return {
      column,
      value: user[column.column_name],
    };
  });

  return (
    <ErrorBoundaryContext.Provider value={resetError}>
      {error && <p>An error occurred: {error.message}</p>}
      <ul>
        {fields.map(({ column, value }, index) => {
          const columnName = column.column_name;
          return (
            <li key={index}>
              <DatabaseValue
                label={columnName}
                column={column}
                value={value}
                getAction={() => {
                  return useRouteUrl(PUT_USER_ROUTE, { columnName });
                }}
              />
            </li>
          );
        })}
      </ul>
    </ErrorBoundaryContext.Provider>
  );
};
