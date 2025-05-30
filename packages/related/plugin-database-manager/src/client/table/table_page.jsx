import { Route } from "@jsenv/router";
import { DatabaseTable } from "../components/database_table.jsx";
import { GET_TABLES_ROUTE, UPDATE_TABLE_ACTION } from "./table_routes.js";
import { tableInfoSignal, tablePublicFilterSignal } from "./table_signals.js";

export const TableRoutes = () => {
  return <Route route={GET_TABLES_ROUTE} loaded={TablePage} />;
};

const TablePage = () => {
  const tablePublicFilter = tablePublicFilterSignal.value;
  const { columns, data } = tableInfoSignal.value;

  return (
    <>
      <DatabaseTable
        column={columns}
        data={data}
        action={UPDATE_TABLE_ACTION}
      />
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
