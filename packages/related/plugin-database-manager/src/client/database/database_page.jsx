import { Button } from "@jsenv/navi";
import { DatabaseValue } from "../components/database_value.jsx";
import { Page, PageBody, PageHead } from "../layout/page.jsx";
import { RoleLink } from "../role/role_link.jsx";
import { DatabaseSvg } from "./database_icons.jsx";
import { DATABASE } from "./database_store.js";

export const DatabasePage = ({ database }) => {
  const datname = database.datname;
  const deleteDatabaseAction = DATABASE.DELETE.bindParams({ datname });

  return (
    <Page>
      <PageHead
        actions={[
          {
            component: (
              <Button
                confirmMessage={`Are you sure you want to delete ${datname}?`}
                action={deleteDatabaseAction}
              >
                Delete
              </Button>
            ),
          },
        ]}
      >
        <PageHead.Label icon={<DatabaseSvg />} label={"Database:"}>
          {datname}
        </PageHead.Label>
      </PageHead>
      <PageBody>
        <DatabaseFields database={database} />
        <a
          href="https://www.postgresql.org/docs/14/sql-alterdatabase.html"
          target="_blank"
        >
          ALTER DATABASE documentation
        </a>
      </PageBody>
    </Page>
  );
};

const DatabaseFields = ({ database }) => {
  const columns = database.meta.columns;
  const ownerRole = database.ownerRole;

  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });

  return (
    <ul>
      {columns.map((column) => {
        const columnName = column.column_name;
        const value = database ? database[columnName] : "";
        const action = DATABASE.PUT.bindParams({
          datname: database.datname,
          columnName,
        });

        if (columnName === "datdba") {
          // we will display this elswhere
          return (
            <li key={columnName}>
              Owner:
              <RoleLink role={ownerRole}>{ownerRole.rolname}</RoleLink>
            </li>
          );
        }
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
