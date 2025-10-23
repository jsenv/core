import { Button } from "@jsenv/navi";
import { DatabaseFieldset, RoleField } from "../components/database_field.jsx";
import { TABLE } from "./table_store.js";

export const TableSettings = ({ table }) => {
  const tablename = table.tablename;
  const deleteTableAction = TABLE.DELETE.bindParams({ tablename });

  return (
    <div>
      <DatabaseFieldset
        item={table}
        columns={table.meta.columns}
        usePutAction={(columnName, valueSignal) =>
          TABLE.PUT.bindParams({
            tablename: table.tablename,
            columnName,
            columnValue: valueSignal,
          })
        }
        customFields={{
          tableowner: () => {
            const ownerRole = table.ownerRole;
            return <RoleField role={ownerRole} />;
          },
        }}
      />

      <a
        href="https://www.postgresql.org/docs/14/ddl-basics.html"
        target="_blank"
      >
        TABLE documentation
      </a>

      <div>
        <p>
          <Button
            data-confirm-message={`Are you sure you want to delete the table "${tablename}"?`}
            action={deleteTableAction}
          >
            Delete this table
          </Button>
        </p>
      </div>
    </div>
  );
};
