import { Route } from "@jsenv/router";
import { GET_USER_ROUTE, PUT_USER_ROUTE } from "./user_routes.js";
import { DatabaseValue } from "../components/database_value.jsx";

export const UserRoutes = () => {
  return <Route route={GET_USER_ROUTE} loaded={UserPage} />;
};

const UserPage = ({ route }) => {
  const { columns, user } = route.data;

  const fields = columns.map((column) => {
    return {
      column,
      value: user[column.column_name],
    };
  });

  return (
    <ul>
      {fields.map(({ column, value }, index) => {
        console.log(column);
        return (
          <li key={index}>
            <label>
              <span>{column.column_name}:</span>
              <DatabaseValue
                tableName="pg_roles"
                column={column}
                value={value}
                putRoute={PUT_USER_ROUTE}
              />
            </label>
          </li>
        );
      })}
    </ul>
  );
};
