TODO:

- il y a un souci avec les params étant des valeurs primitive:

si l'action avait des autres params, la valeur primitive va l'écraser
donc c'est ok lorsque l'action est juste une fonction
ou qu'elle n'a pas de param

ca ne fonctionnera plus lorsque l'action aure des params deja bind

- validation message should be one per <form>
  not one per page

as a result we should not remove on blur

Otherwise when clickin on several parts of the page and trigerring many actions
we see a single error even if there is many
