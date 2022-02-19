const imgUrl = new URL("./img.png", import.meta.url)

export const imgUrlIsInstanceOfUrl = imgUrl instanceof URL

export const imgUrlString = String(imgUrl)
