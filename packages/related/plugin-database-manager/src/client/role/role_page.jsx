import {
  ErrorBoundaryContext,
  Route,
  SPADeleteButton,
  useRouteParam,
} from "@jsenv/router";
import { useErrorBoundary } from "preact/hooks";
import { DatabaseValue } from "../components/database_value.jsx";
import { DatabaseLink } from "../database/database_link.jsx";
import { PageBody, PageHead } from "../layout/page.jsx";
import { pickRoleIcon } from "./role_icons.jsx";
import {
  DELETE_ROLE_ACTION,
  GET_ROLE_ROUTE,
  PUT_ROLE_ACTION,
} from "./role_routes.js";
import {
  useActiveRole,
  useActiveRoleColumns,
  useActiveRoleDatabases,
} from "./role_signals.js";

export const RoleRoutes = () => {
  return <Route route={GET_ROLE_ROUTE} renderLoaded={() => <RolePage />} />;
};

const RolePage = () => {
  const [error, resetError] = useErrorBoundary();
  const rolname = useRouteParam(GET_ROLE_ROUTE, "rolname");
  const deleteRoleAction = DELETE_ROLE_ACTION.bindParams({ rolname });
  const role = useActiveRole();
  const RoleIcon = pickRoleIcon(role);

  return (
    <ErrorBoundaryContext.Provider value={resetError}>
      {error && <ErrorDetails error={error} />}
      <PageHead
        actions={[
          {
            component: (
              <SPADeleteButton action={deleteRoleAction}>
                Delete
              </SPADeleteButton>
            ),
          },
        ]}
      >
        <PageHead.Label icon={<RoleIcon />} label={"Role:"}>
          {rolname}
        </PageHead.Label>
      </PageHead>
      <PageBody>
        <RoleFields role={role} />
        <RoleDatabases role={role} />
        <a
          href="https://www.postgresql.org/docs/14/sql-alterrole.html"
          target="_blank"
        >
          ALTER ROLE documentation
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

const RoleFields = ({ role }) => {
  const columns = useActiveRoleColumns();

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
        const action = PUT_ROLE_ACTION.bindParams({
          rolname: role.rolname,
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

const RoleDatabases = ({ role }) => {
  const databases = useActiveRoleDatabases();

  return (
    <div>
      <h2>Databases owned by {role.rolname}</h2>
      <ul>
        {databases.map((database) => {
          return (
            <li key={database.oid}>
              <DatabaseLink database={database}>
                {database.datname}
              </DatabaseLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
