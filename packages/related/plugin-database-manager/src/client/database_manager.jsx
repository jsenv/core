import { render } from "preact";
import { signal, effect } from "@preact/signals";
import { registerRoutes, SPAForm, useRouteUrl } from "@jsenv/router";
import { Table } from "./table.jsx";

const tablePublicFilterSignal = signal(false);
const tableInfoSignal = signal({ columns: [], data: [] });

const [PATCH_TABLE_PROP] = registerRoutes({
  "PATCH /.internal/database/api/tables/:name/:prop": async ({
    params,
    formData,
  }) => {
    const name = params.name;
    const prop = params.prop;
    const value = formData.get("value");
    await fetch(`/.internal/database/api/tables/${name}/${prop}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
  },
});

effect(async () => {
  const tablePublicFilter = tablePublicFilterSignal.value;
  const response = await fetch(
    `/.internal/database/api/tables?public=${tablePublicFilter}`,
  );
  const tables = await response.json();
  tableInfoSignal.value = tables;
});

const App = () => {
  const tablePublicFilter = tablePublicFilterSignal.value;

  return (
    <div>
      <h1>Database Manager</h1>
      <p>Explore and manage your database.</p>

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

      <TableList />
    </div>
  );
};

const TableNameCell = ({ name }) => {
  return (
    <div>
      <span>{name}</span>
    </div>
  );
};

const BooleanCell = ({ tableName, columnName, checked }) => {
  const patchTablePropUrl = useRouteUrl(PATCH_TABLE_PROP, {
    name: tableName,
    prop: columnName,
  });
  return (
    <SPAForm action={patchTablePropUrl} method="PATCH">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          if (e.target.checked) {
            // we need the fetch
          } else {
          }
        }}
        readOnly
      />
    </SPAForm>
  );
};

const CellDefaultComponent = ({ tableName, column, children }) => {
  if (column.name === "tablename") {
    return <TableNameCell name={children} />;
  }
  if (column.data_type === "boolean") {
    return (
      <BooleanCell
        tableName={tableName}
        columnName={column.column_name}
        checked={children}
      />
    );
  }
  return String(children);
};

const TableList = () => {
  const { columns, data } = tableInfoSignal.value;
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  const tableColumns = columns.map((column) => {
    const columnName = column.column_name;

    return {
      accessorKey: columnName,
      header: () => <span>{columnName}</span>,
      cell: (info) => {
        const value = info.getValue();
        // TODO: how to get table name here
        debugger;
        return (
          <CellDefaultComponent column={column}>{value}</CellDefaultComponent>
        );
      },
      footer: (info) => info.column.id,
    };
  });

  return <Table columns={tableColumns} data={data} />;
};

render(<App />, document.querySelector("#app"));
