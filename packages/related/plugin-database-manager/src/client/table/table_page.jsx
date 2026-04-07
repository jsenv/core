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

import {
  Button,
  Head,
  Icon,
  Link,
  Nav,
  Route,
  useAsyncData,
} from "@jsenv/navi";

import { Page, PageBody, PageHead } from "../layout/page.jsx";
import {
  TABLE_GET_ACTION,
  TABLE_INDEX_ROUTE,
  TABLE_SETTINGS_ROUTE,
} from "../routes.js";
import { DataSvg } from "../svg/data_svg.jsx";
import { SettingsSvg } from "../svg/settings_svg.jsx";
import { TableData } from "./table_data.jsx";
import { TableSvg } from "./table_icons.jsx";
import { TableSettings } from "./table_settings.jsx";
import { TABLE } from "./table_state.js";

export const TablePage = () => {
  const { data: table } = useAsyncData(TABLE_GET_ACTION);
  const tablename = table.tablename;

  return (
    <>
      <Head>
        <title>Table: {tablename}</title>
      </Head>
      <Page data-ui-name="<TablePage />">
        <PageHead spacingBottom={0}>
          <PageHead.Label
            icon={<TableSvg />}
            label="Table:"
            actions={[
              {
                component: (
                  <Button
                    data-confirm-message={`Are you sure you want to delete the table "${tablename}"?`}
                    action={() => {
                      return TABLE.DELETE({ tablename });
                    }}
                  >
                    Delete
                  </Button>
                ),
              },
            ]}
          >
            {tablename}
          </PageHead.Label>
          <Nav spacing="s">
            <Link
              route={TABLE_INDEX_ROUTE}
              routeParams={{ tablename }}
              appearance="tab"
              paddingX="s"
              paddingY="xs"
              currentIndicator
            >
              <Icon>
                <DataSvg />
              </Icon>
              Data
            </Link>
            <Link
              route={TABLE_SETTINGS_ROUTE}
              routeParams={{ tablename }}
              appearance="tab"
              paddingX="s"
              paddingY="xs"
              currentIndicator
            >
              <Icon>
                <SettingsSvg />
              </Icon>
              Settings
            </Link>
          </Nav>
        </PageHead>
        <PageBody>
          <Route>
            <Route
              route={TABLE_INDEX_ROUTE}
              element={TableData}
              elementProps={{ table }}
            />
            <Route
              route={TABLE_SETTINGS_ROUTE}
              element={TableSettings}
              elementProps={{ table }}
            />
          </Route>
        </PageBody>
      </Page>
    </>
  );
};
