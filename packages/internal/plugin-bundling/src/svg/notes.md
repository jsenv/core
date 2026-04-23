JSenv as everything required to be able to bundle svgs during build

It could detect svg usages in css and js and transform code
to make them reference an svg sprite

https://github.com/SpiriitLabs/vite-plugin-svg-spritemap/blob/58a41a762db4692bfc273540b99c7339a45d416f/src/core/svgManager.ts#L1

Si du code fait ceci:

const svgUrl = import.meta.resolve("./file.svg");

image.src = svgUrl;

Ca devient

const svgUrl = "/path/sprite.svg#file";
image.src = svgUrl;
