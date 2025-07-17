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

import { Button } from "@jsenv/navi";
import { DatabaseValue } from "../components/database_value.jsx";
import { Page, PageBody, PageHead } from "../layout/page.jsx";
import { RoleLink } from "../role/role_link.jsx";
import { TableSvg } from "./table_icons.jsx";
import { TABLE } from "./table_store.js";

export const TablePage = ({ table }) => {
  const tablename = table.tablename;
  const deleteTableAction = TABLE.DELETE.bindParams({ tablename });

  return (
    <Page>
      <PageHead
        actions={[
          {
            component: (
              <Button
                confirmMessage={`Are you sure you want to delete ${tablename}`}
                action={deleteTableAction}
              >
                Delete
              </Button>
            ),
          },
        ]}
      >
        <PageHead.Label icon={<TableSvg />} label={"Table:"}>
          {tablename}
        </PageHead.Label>
      </PageHead>
      <PageBody>
        <>
          <TableFields table={table} />
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

const TableFields = ({ table }) => {
  const columns = table.meta.columns;
  const ownerRole = table.ownerRole;

  columns.sort((a, b) => {
    return a.ordinal_position - b.ordinal_position;
  });

  return (
    <ul>
      {columns.map((column) => {
        const columnName = column.column_name;
        const value = table ? table[columnName] : "";
        const action = TABLE.PUT.bindParams({
          tablename: table.tablename,
          columnName,
        });

        if (columnName === "tableowner") {
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
