/** encore du boulot sur border collapse
 *
 *
 * le mieux c'est surement de dabord créer toutes les cellules
 * puis alors on regarde ce qu'on peut faire
 * sachant que si on voit un border left mais pas de right alors on pref voir si on peut collapse toute la colonne sur
 * left, sinon on voir si on peut collapse sur right
 *
 * et qu'on ne fait ça que pour les borders intermédiaaires (first left et last right pas bespoin)
 */

import { renderTable } from "@jsenv/terminal-table";

const a_strange_case = renderTable(
  [
    [
      { value: "", border: null },
      { value: "free", border: {} },
    ],
    [
      { value: "feature a", border: {} },
      { value: "✔", border: {} },
    ],
  ],
  {
    borderCollapse: true,
  },
);

console.log(a_strange_case);
