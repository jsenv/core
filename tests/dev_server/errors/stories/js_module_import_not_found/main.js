/* eslint-disable import/no-unresolved */
// above 1
// above 2
// above 3
/* before */ import "./not_found.js"; /* after */
// below 1
// below 2
// below 3
/* eslint-enable import/no-unresolved */

if (import.meta.hot) {
  import.meta.hot.accept();
}
