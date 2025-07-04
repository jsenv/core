- dans le form multiple on a des valeur qui sortent de nulle part une fois l'action terminée
  -> on a pas le actionend sur chaque input du coup le nav state reste

  je pense qu'il faudrait un useActionEvents

  qui du coup écoutera soit l'input soit le form
  (dans le cas d'un fieldset je sais pas trop, on pourrait récup le fieldset le plus proche et écouter les events
  mais je vois pas l'interet du fieldset maintenant, enfin euhhh sauf siiii bah non en fait)

- le loading state pour un bouton

(le loader doit encadrer le bouton nickel chrome, donc surement lire padding ou un truc du genre)
le bouton devra aussi effacer son border avec transparent pour privilégier le loader

- pareil pour le loading des inputs

- re-introduire label comme disabled pour l'input
  en le partageant aussi haut on perd cette capacité

- retester editable text c'est un gros morceau

- puis on reprend ou on en était (utiliser les nouveaux trucs dans database explorer)
