import { SPAForm, useRouteUrl } from "@jsenv/router";
import { Table } from "../table.jsx";
import { tableInfoSignal, tablePublicFilterSignal } from "./table_signals.js";
import { PUT_TABLE_PROP } from "../routes.js";

export const TablePage = () => {
  const tablePublicFilter = tablePublicFilterSignal.value;

  return (
    <>
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
    </>
  );
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
