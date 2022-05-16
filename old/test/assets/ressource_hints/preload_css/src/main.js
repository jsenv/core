const logCSSURL = () => {
  console.log(new URL("./main.css", import.meta.url))
}

logCSSURL()
