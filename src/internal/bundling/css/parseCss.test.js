import { resolveUrl, readFile } from "@jsenv/util"
import { parseCss } from "./parseCss.js"

const cssFileUrl = resolveUrl("./style-a.css", import.meta.url)
const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const css = await readFile(cssFileUrl)
const result = await parseCss(css, { projectDirectoryUrl, cssFileUrl })

/**
une fois qu'on a toutes les dépendances ça devient plus facile
mais il faut tout de meme faire plein de truc

en premier il faudrait générer le hash de tous les assets
-> faire une fonction qui prend cssDependencyMap de tous les css
et genere une url de fichier de destination avec le hash

cette fonction retourne un mapping de url vers url de destination

-> faire une fonction qui prend cssDependencyMap et en déduit
les css les moins dependant.
Cette fonction prend ensuite le tableau un par un et
update le chemin des assets + minifie le css et genere une url de destination avec hash

le fichier suivant attend alors la minification du fichier précédent et
met a jour tout ces chemin vers assets + import rule
et ainsi de suite.

cette fonction retourn un mapping de url css vers url de destination

cet ensemble sera utilisé dans rollup
ou on demandera a parsé un fichier css et on récup un mapping urls
+ le contenu des assets finaux + les contenu des css minifié

on fera emitFile dans rollup en mode asset
on gardera en mémoire le mapping au cas ou un asset ou css
serait référencé dans le js. De sorte que lorsqu'on veut récup le chemin vers l'asset
on en est capable
-> https://rollupjs.org/guide/en/#resolvefileurl

mais attention resolveFileUrl n'est pas pris en compte pour augmentChunkHash
il faut donc détecter cela et ajouter le css/assets référencé dans ce hash
https://github.com/Anidetrix/rollup-plugin-styles/blob/7532971ed8e0a62206c970f336efaf1bcf5c3315/src/index.ts#L126

style.css -> dist/style-[hash].css
icon.img -> dist/icon-[hash].img

il faudrait pour cela qu'on puisse indiquer a rollup
que si un fichier js référence icon.img, l'url est maintenant différente, pareil pour le css

ça marcherais \o/


*/

console.log(result)
