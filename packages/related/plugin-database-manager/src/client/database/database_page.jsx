import { Button } from "@jsenv/navi";
import { DatabaseFieldset } from "../components/database_field.jsx";
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
        <DatabaseFieldset
          item={database}
          columns={database.meta.columns}
          usePutAction={(columnName) =>
            DATABASE.PUT.bindParams({
              datname: database.datname,
              columnName,
            })
          }
          customFields={{
            datdba: () => {
              const ownerRole = database.ownerRole;
              return (
                <>
                  Owner:
                  <RoleLink role={ownerRole}>{ownerRole.rolname}</RoleLink>{" "}
                </>
              );
            },
          }}
        />
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
