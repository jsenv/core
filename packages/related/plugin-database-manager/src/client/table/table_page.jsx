import {
  ErrorBoundaryContext,
  Route,
  SPADeleteButton,
  useRouteParam,
} from "@jsenv/router";
import { useErrorBoundary } from "preact/hooks";
import { PageBody, PageHead } from "../layout/page.jsx";
import { TableSvg } from "./table_icons.jsx";
import { DELETE_TABLE_ACTION, GET_TABLE_ROUTE } from "./table_routes.js";
import { useTable } from "./table_signals.js";

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
            {JSON.stringify(table)}
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
