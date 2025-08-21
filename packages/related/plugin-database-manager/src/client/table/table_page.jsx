/**
 * ce qui me parait le mieux:
 *
 *
 * c'est pas vraiment intéréssant de voir tout les base de données en vrai donc:
 *
 * -> on affiche la base de données courant + un moyen d'en changer
 * -> on affiche les tables de la base de données courante
 * -> un moyen de modifier la base de données courante "chaispascomment"
 *
 * - une icone gear en haut a droite fait apparaitre un menu de réglage dans le header
 * qui permet de renommer la table et modifier ses params genre son owner etc
 *
 * - la page elle se concentre sur l'affiche du contenu de la table
 * on commencera par les colones de la table elle-meme
 * qu'on peut bouger, renommer, supprimer, modifier le type etc
 *
 *
 */

import { Link } from "@jsenv/navi";
import { DatabaseFieldset, RoleField } from "../components/database_field.jsx";
import { Page, PageBody, PageHead } from "../layout/page.jsx";
import { TABLE_SETTINGS_ROUTE } from "../routes.js";
import { TableSvg } from "./table_icons.jsx";
import { TABLE } from "./table_store.js";

export const TablePage = ({ table }) => {
  const tablename = table.tablename;
  const tableSettingUrl = TABLE_SETTINGS_ROUTE.buildUrl({ tablename });

  return (
    <Page>
      <PageHead
        actions={[
          {
            component: <Link href={tableSettingUrl}>Settings</Link>,
          },
        ]}
      >
        <PageHead.Label icon={<TableSvg />} label={"Table:"}>
          {tablename}
        </PageHead.Label>
      </PageHead>
      <PageBody>
        <>
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
        </>
      </PageBody>
    </Page>
  );
};
