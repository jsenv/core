import { Button } from "@jsenv/navi";
import { DatabaseFieldset, RoleField } from "../components/database_field.jsx";
import { Page, PageBody, PageHead } from "../layout/page.jsx";
import { DatabaseSvg } from "./database_icons.jsx";
import { DATABASE } from "./database_store.js";

export const DatabasePage = ({ database }) => {
  const datname = database.datname;
  const deleteDatabaseAction = DATABASE.DELETE.bindParams({ datname });

  return (
    <Page data-ui-name="<DatabasePage />">
      <PageHead
        actions={[
          {
            component: (
              <Button
                data-confirm-message={`Are you sure you want to delete the database "${datname}"?`}
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
          usePutAction={(columnName, valueSignal) =>
            DATABASE.PUT.bindParams({
              datname: database.datname,
              columnName,
              columnValue: valueSignal,
            })
          }
          customFields={{
            datdba: () => {
              const ownerRole = database.ownerRole;
              return <RoleField role={ownerRole} />;
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
