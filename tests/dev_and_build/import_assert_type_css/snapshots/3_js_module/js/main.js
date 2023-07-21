import sheet from "/js/main.css.js" ;

document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

// on firefox + webkit we have to wait a bit,
// it seems the styles are applied on next js event loop
await new Promise((resolve) => setTimeout(resolve, 200));
const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor;
console.log({ bodyBackgroundColor });

// let 700ms for the background image to load
await new Promise((resolve) => setTimeout(resolve, 700));
const bodyBackgroundImage = getComputedStyle(document.body).backgroundImage;
console.log({ bodyBackgroundImage });

window.resolveResultPromise({
  bodyBackgroundColor,
  bodyBackgroundImage,
});
