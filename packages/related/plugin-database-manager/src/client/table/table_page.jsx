import { Route } from "@jsenv/router";
import { tableInfoSignal, tablePublicFilterSignal } from "./table_signals.js";
import { GET_TABLES_ROUTE, PUT_TABLE_ROUTE } from "./table_routes.js";
import { DatabaseTable } from "../components/database_table.jsx";

export const TableRoutes = () => {
  return <Route route={GET_TABLES_ROUTE} loaded={TablePage} />;
};

const TablePage = () => {
  const tablePublicFilter = tablePublicFilterSignal.value;
  const { columns, data } = tableInfoSignal.value;

  return (
    <>
      <DatabaseTable column={columns} data={data} putRoute={PUT_TABLE_ROUTE} />

      <form>
        <label>
          <input
            type="checkbox"
            checked={tablePublicFilter}
            onChange={(e) => {
              if (e.target.checked) {
                tablePublicFilterSignal.value = true;
              } else {
                tablePublicFilterSignal.value = false;
              }
            }}
          ></input>
          Public
        </label>
      </form>
    </>
  );
};
