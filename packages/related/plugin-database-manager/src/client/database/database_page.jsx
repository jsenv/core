import { Button } from "@jsenv/navi";
import { DatabaseField } from "../components/database_field.jsx";
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
          // TODO: display a select with the ownerRole being selected
          // this select should also be loading because we'll loading other roles
          // and we can open that select while it's loading ideally (but not for now)
          // this select will display all other roles and will update the role on change
          return (
            <li key={columnName}>
              Owner:
              <RoleLink role={ownerRole}>{ownerRole.rolname}</RoleLink>
            </li>
          );
        }
        return (
          <li key={columnName}>
            <DatabaseField
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
