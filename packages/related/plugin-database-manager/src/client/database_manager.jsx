import { render } from "preact";
import { signal, effect } from "@preact/signals";
import { registerRoutes, SPAForm, useRouteUrl } from "@jsenv/router";
import { Table } from "./table.jsx";
import "./database_manager.css" with { type: "css" };
import { DatabaseNavbar } from "./database_navbar.jsx";

const tablePublicFilterSignal = signal(false);
const tableInfoSignal = signal({ columns: [], data: [] });

const [PUT_TABLE_PROP] = registerRoutes({
  "PUT /.internal/database/api/tables/:name/:prop": async ({
    params,
    formData,
  }) => {
    const name = params.name;
    const prop = params.prop;
    const value = formData.get("value");
    await fetch(`/.internal/database/api/tables/${name}/${prop}`, {
      method: "PUT",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(value),
    });
    const { data, ...rest } = tableInfoSignal.value;
    const table = data.find((table) => table.tablename === name);
    table[prop] = value;
    tableInfoSignal.value = {
      ...rest,
      data: [...data],
    };
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
      <aside>
        <DatabaseNavbar />
      </aside>
      <main>
        <h1 title="Explore and manager your database">Database Manager</h1>

        <TableList />

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
      </main>
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

const BooleanCell = ({ isUpdatable, tableName, columnName, checked }) => {
  const putTablePropUrl = useRouteUrl(PUT_TABLE_PROP, {
    name: tableName,
    prop: columnName,
  });
  return (
    <SPAForm action={putTablePropUrl} method="PUT">
      <input
        type="checkbox"
        disabled={!isUpdatable}
        name="value"
        checked={checked}
        onChange={(e) => {
          const form = e.target.form;
          form.requestSubmit();
        }}
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
        isUpdatable={
          column.is_updatable === "YES" || column.column_name === "rowsecurity"
        }
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
        const tableName = info.row.original.tablename;
        return (
          <CellDefaultComponent tableName={tableName} column={column}>
            {value}
          </CellDefaultComponent>
        );
      },
      footer: (info) => info.column.id,
    };
  });

  return <Table columns={tableColumns} data={data} />;
};

render(<App />, document.querySelector("#app"));
