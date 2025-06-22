## Prochain truc a faire:

1. Demo 3 avec un details qui fait une requete GET qui n'est pas la requete principale
   l'idée la c'est de load l'action en fonction d'un signal lié au local storage
   cela dit le signal est dynamique dans le sens ou chaque action aura un item associé
   a priori ce sera juste un
   onActionCreated: (action) => {
   // on check le local storage pour call .load direct
   }
   onActionLoaded: (action) => {
   // on set le local storage ici?
   // pourquoi pas mais en fait non je crois pas
   // on veut pas de ca ici sinon on va potentiellement load a tort
   }

   -> sauf que si on est sur une autre page on load pour rien
   puisque le details est pas render, ahhhhhh
   c'est que si je suis sur la bonne page que je veux ca

   par exemple user.friends ne serait load que si on create une action pour ce user
   et qu'on a open son friends details
   par contre si une page cree une action pour ce user sans afficher ses friends on aura load pour rien
   je pense que c'est acceptable
   parce que la plupart du temps on chargera pas l'objet
   et la plupart du temps l'objet alors on voudra ses infos
   et meme quand c'est pas le cas il y a des chanes qu'on en veuille

   cela dit le cas 3 ou on load pour rien peut etre significatif
   donc il vaut ptet mieux attendre que le <details> soit render pour etre sur

   ou alors c'est au code métier de dire "oui mais que si je suis sur la page X, Y, Z"

2. ActionRenderer basic
3. ActionRenderer lazy
4. le renaming d'un item devrait mettre a jour le local storage (plus tard on mettrait aussi a jour l'url)
