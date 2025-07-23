import { Button } from "@jsenv/navi";
import { DatabaseField } from "../../components/database_field.jsx";
import { Page, PageBody, PageHead } from "../../layout/page.jsx";
import { RoleDatabaseList } from "../role_database_list.jsx";
import { pickRoleIcon } from "../role_icons.jsx";
import { ROLE } from "../role_store.js";
import { RoleGroupMemberList } from "./role_group_member_list.jsx";

export const RoleGroupPage = ({ role }) => {
  const rolname = role.rolname;
  const deleteRoleAction = ROLE.DELETE.bindParams({ rolname });
  const RoleIcon = pickRoleIcon(role);

  return (
    <Page>
      <PageHead
        actions={[
          {
            component: (
              <Button
                data-confirm-message={`Are you sure you want to delete ${rolname}?`}
                action={deleteRoleAction}
              >
                Delete
              </Button>
            ),
          },
        ]}
      >
        <PageHead.Label icon={<RoleIcon />} label={"Role Group:"}>
          {rolname}
        </PageHead.Label>
      </PageHead>
      <PageBody>
        <RoleFields role={role} />
        <RoleGroupMemberList role={role} />
        <RoleDatabaseList role={role} />
        <a
          href="https://www.postgresql.org/docs/current/sql-createrole.html"
          target="_blank"
        >
          ROLE documentation
        </a>
      </PageBody>
    </Page>
  );
};

const RoleFields = ({ role }) => {
  const columns = role.meta.columns;
  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });
  const fields = [];
  for (const column of columns) {
    const columnName = column.column_name;
    if (columnName === "rolcanlogin") {
      continue;
    }
    const value = role ? role[columnName] : "";
    fields.push({
      column,
      value,
    });
  }

  return (
    <ul>
      {fields.map(({ column, value }) => {
        const columnName = column.column_name;
        const action = ROLE.PUT.bindParams({
          rolname: role.rolname,
          columnName,
        });

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
