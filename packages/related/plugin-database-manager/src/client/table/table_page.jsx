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

import { Link, Route, Tab, TabList, UITransition } from "@jsenv/navi";
import { Page, PageBody, PageHead } from "../layout/page.jsx";
import { TABLE_DATA_ROUTE, TABLE_SETTINGS_ROUTE } from "../routes.js";
import { TableData } from "./table_data.jsx";
import { TableSvg } from "./table_icons.jsx";
import { TableSettings } from "./table_settings.jsx";

export const TablePage = ({ table }) => {
  const tablename = table.tablename;
  const tableDataUrl = TABLE_DATA_ROUTE.buildUrl({ tablename });
  const tableSettingUrl = TABLE_SETTINGS_ROUTE.buildUrl({ tablename });

  return (
    <Page data-ui-name="<TablePage />">
      <PageHead spacingBottom={0}>
        <PageHead.Label icon={<TableSvg />} label={"Table:"}>
          {tablename}
        </PageHead.Label>
        <TabList>
          <Tab>
            <Link href={tableDataUrl}>Data</Link>
          </Tab>
          <Tab>
            <Link href={tableSettingUrl}>Settings</Link>
          </Tab>
        </TabList>
      </PageHead>
      <PageBody>
        <UITransition debugTransition>
          <Route route={TABLE_DATA_ROUTE}>
            {() => <TableData table={table} />}
          </Route>
          <Route route={TABLE_SETTINGS_ROUTE}>
            {() => <TableSettings table={table} />}
          </Route>
        </UITransition>
      </PageBody>
    </Page>
  );
};
