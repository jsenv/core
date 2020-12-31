import whatever from "./whatever.js"

const startValue = parseInt(localStorage.getItem(whatever)) || 41
const value = startValue + 1
localStorage.setItem(whatever, value)

export default value
