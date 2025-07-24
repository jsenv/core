- La table qui affiche une page, on mettra les detais dans un bouton settings en haut a droite
  Qui ouvrira les infos a propos de cette tables et on focus sur les données au lieu des settings de la table

- See table columns, ability to add, update, remove table columns
- Ability to see table rows, ability to add/update/remove rows
- Pagination of course

A word on the default values here:

By default we don't rerun GET when something happens
(GET are reset by DELETE, and other action (PUT/PATCH) would update the UI accordingly thanks to signals)
And it's great as is

We rerun GET_MANY only on POST because

- for POST the created item might be in the list or not, backend knows better than us
  (could be dependent on filters pagination etc)
- for DELETE
  // 1. UI handles deletions via store signals (selectAll filters out deleted items)
  // 2. DELETE rarely changes the backend list content beyond removal
  // This avoids unnecessary API calls - can be overridden if needed
