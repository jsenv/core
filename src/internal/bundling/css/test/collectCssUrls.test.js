import { resolveUrl, readFile } from "@jsenv/util"
import { collectCssUrls } from "../collectCssUrls.js"

const cssFileUrl = resolveUrl("./style-a.css", import.meta.url)
const projectDirectoryUrl = resolveUrl("./", import.meta.url)
const css = await readFile(cssFileUrl)
const result = await collectCssUrls(css, { projectDirectoryUrl, cssFileUrl })

/**

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
