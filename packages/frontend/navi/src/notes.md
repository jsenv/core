- le souci que je vais avoir avec ui transition

c'est que je vais surement vouloir des transitions entre des trucs qui sont pas enfant direct si?

donc il fauti vérifier un truc:

QUID si on a un UI transition qui wrap un UITransition?

(Genre des cross-fade d'une page a l'autre
Puis un UI transition pour chaque sous-état d'une page)

a priori ça ne marchera pas parce que le UITransition comptera comme un enfant
(vu au'il introduite toute une structure HTML)
il faudrait donc supporter de regarder TOUT les descendant du slot mais en cherchant si on a

- pas content-key sur le slot
- et pas de content-key sur le firstChild -> alors on cherche le content-key sur les descendants

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
