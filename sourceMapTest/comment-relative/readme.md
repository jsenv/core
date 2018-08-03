OK c'est ce qu'on doit faire au final:

* En gros le client demande au serveur un fichier à `compiled/folder/file.js`.
* En réalité on sait que ce fichier se trouve à `folder/file.js`.
* On met le fichier dans `build/folder/file.js/eocslhjchrjk/file.js`
* Dans ce fichier on met `//# sourceMappingURL = './file.js.map'`
* Chrome ou vscode fera alors une requête vers `compiled/folder/file.js.map` que le serveur doit rediriger vers `build/folder/file.js/eocslhjchrjk/file.js.map`. D'une manière où d'une autre le serveur doit être capable de retrouver `eocslhjchrjk` depuis cette requête.
* sourceMap.file doit être `folder/file.js` car c'est le nom d'origine du fichier
* sourceMap.sources doit être `['../folder/file.js']` pour que le browser sache où est le fichier original
  et puisse éventuellement le fetch si le sourcemap ne contient pas le code source

Le seul point à fixer c'est donc comment retrouver `eocslhjchrjk` depuis une requête à `compiled/folder/file.js.map`.
Comme `eocslhjchrjk` dépend directement du fichier qu'on demande.
Je pense qu'il faut une fonction qui retourne `eocslhjchrjk` et d'autres méta depuis un fichier.
On s'en servira ici pour service le bon .map et dans l'autre cas pour voir si y'a un cache valide ou sinon le créer
