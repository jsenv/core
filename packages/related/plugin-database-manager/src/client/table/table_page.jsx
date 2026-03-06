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

import { Icon, Route, Routes, Tab, TabList } from "@jsenv/navi";

import { Page, PageBody, PageHead } from "../layout/page.jsx";
import { TABLE_DATA_ROUTE, TABLE_SETTINGS_ROUTE } from "../routes.js";
import { DataSvg } from "../svg/data_svg.jsx";
import { SettingsSvg } from "../svg/settings_svg.jsx";
import { TableData } from "./table_data.jsx";
import { TableSvg } from "./table_icons.jsx";
import { TableSettings } from "./table_settings.jsx";

export const TablePage = ({ table }) => {
  const tablename = table.tablename;

  return (
    <Page data-ui-name="<TablePage />">
      <PageHead spacingBottom={0}>
        <PageHead.Label icon={<TableSvg />} label="Table:">
          {tablename}
        </PageHead.Label>
        <TabList>
          <Tab route={TABLE_DATA_ROUTE} routeParams={{ tablename }}>
            <Icon>
              <DataSvg />
            </Icon>
            Data
          </Tab>
          <Tab route={TABLE_SETTINGS_ROUTE} routeParams={{ tablename }}>
            <Icon>
              <SettingsSvg />
            </Icon>
            Settings
          </Tab>
        </TabList>
      </PageHead>
      <PageBody>
        <Routes>
          <Route
            route={TABLE_DATA_ROUTE}
            element={(rows) => <TableData table={table} rows={rows} />}
          />
          <Route
            route={TABLE_SETTINGS_ROUTE}
            element={<TableSettings table={table} />}
          />
        </Routes>
      </PageBody>
    </Page>
  );
};
