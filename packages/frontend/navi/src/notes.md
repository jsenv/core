- null should be a content-phase

- le ui transition.jsx en gros qui va s'occuper de faire des transitions
  lorsque ses enfants changent
  notons que <Route> devra ssurement changer son fusil d'épaule histoire que ActionRenderer
  puisse voir quand la route stops matching (easy on passera une prop genre disabled au renderer)

- La table qui affiche une page, on mettra les details dans un bouton settings en haut a droite
  Qui ouvrira les infos a propos de cette tables et on focus sur les données au lieu des settings de la table
  (surement qu'on aura
  - api/tables/:tablename/settings
  - api/tables/:tablename/columns
  - api/tables/:tablename/rows
    (et api/tables on verra je serais pas encore)

- See table columns, ability to add, update, remove table columns
- Ability to see table rows, ability to add/update/remove rows
- Pagination of course
- import.meta.css during build should use stylesheet to inject so that it puts an url instead of constructed stylesheet?
