- faire input checkbox avec la nouvelle methode
  il faut que si la checkbox est dans un form/fieldset
  elle mette a jour les params du parent
  pas seulement lors que requestAction mais a chaque change

- mettre javascript:void(${action}) dans le form (juste pour le style et le debug)

- lorsqu'on clique un boutton ayant une action + parent action
  alors le bouton doit récup les param de la parent action

- validation message should be one per <form>
  not one per page

as a result we should not remove on blur

Otherwise when clickin on several parts of the page and trigerring many actions
we see a single error even if there is many
