// eslint-disable-next-line import/no-unresolved
import "./foo.js"

if (import.meta.hot) {
  import.meta.hot.accept()
}
