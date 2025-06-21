Next steps:

J'identifie un "gros" souci

Lorsque je fetch une liste de users potentiellement j'ai des params
qui disent, voici la liste des users dde Nice mettons
mais moi je suis login avec un user d'antibes

donc dans le store des users j'aurais un user d'antibes, X user de Nice

c'est ok c'est le but

mais ensuite la UI doit n'afficher que les users de Nice, on ne doit pas voir
mon user au milieu
pour cela il faut que la liste retourner par let getAll ne contiennent que le résultat
du fetch

cependant il faut aussi que si je touche a un user de cette liste depuis l'éxtérieur il soit mis a jour
donc il me faut une sorte de view sur la liste des users qui soit filtrée

let getAll injecte X users dans le store
-> il garde en mémoire l'id de tout ce qu'il retourne
-> il retourn un computed qui ne renvoit que ces items la

1. Demo 3 avec un details qui fait une requete GET qui n'est pas la requete principale
2. ActionRenderer basic
3. ActionRenderer lazy
