import { Button } from "@jsenv/navi";
import { DatabaseFieldset } from "../../components/database_field.jsx";
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
    <Page data-ui-name="<RoleGroupPage />">
      <PageHead
        actions={[
          {
            component: (
              <Button
                data-confirm-message={`Are you sure you want to delete the role "${rolname}"?`}
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
        <DatabaseFieldset
          item={role}
          columns={role.meta.columns}
          usePutAction={(columnName, valueSignal) =>
            ROLE.PUT.bindParams({
              rolname: role.tablename,
              columnName,
              columnValue: valueSignal,
            })
          }
          ignoredFields={["rolcanlogin"]}
        />
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
