## Prochain truc a faire:

ok le getAll c'est un cas particulier d'action:

- action n'a pas d'item
- si on load l'action avec les memes params alors on garde ce qui se passe
- si on load avec des nouveaux params on cancel si c'est pending et on load le nouveau
  TODO: parce que actuellement une action ne peux pas changer de params
  ca a été pensé différement

  sinon on aurait besoin d'un moyen qu'une action reflete une autre, genre un actionProxy
  et je pense que ca c'est la clé

  genre quand on veut lire cette action on lis dynamiquement une autre -> wep c'est banger ca

  on ferait un truc genre
  lorsqu'on accede a une prop de cette action
  on va lire l'action courante qu'on trouve direct avec un instantiate

1. Demo 3 avec un details qui fait une requete GET qui n'est pas la requete principale
2. ActionRenderer basic
3. ActionRenderer lazy
