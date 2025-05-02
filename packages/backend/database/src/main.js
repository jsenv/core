/**
 * Next steps:
 *
 * - Faire un test unitaires capable de faire les choses suivantes:
 * ajouter un entrée en DB, vérifier ensuite qu'elle a bien été ajoutée puis la supprimer et verifier qu'elle a bien été supprimée
 *
 * https://github.com/ikalnytskyi/action-setup-postgres/blob/master/action.yml
 *
 * - The user we create during setup don't need to be able to create a database as superuser might create it
 * it would be "safer" or just more precise not to give a right that is not needed
 */

import postgres from "postgres";

export { readParamsFromContext } from "./read_params_from_context.js";

export const connectAs = ({ host, port, username, password, database }) => {
  const sql = postgres({
    host,
    port,
    username,
    password,
    database,
  });
  return sql;
};
