/*
 * Write a test ensuring autoreload works on import_type_css
 * we can reuse files in client/import_type_css
 * And do the following:
 * - Open a browser and visit import_type_css/main.html
 * - Ensure background body color is yellow
 * - Update import_type_css/src/style.css to
 *   body { background-color: green }
 * - Wait 500ms and ensure background body color is green
 * - Update import_type_css/main.js
 *   ```diff
 *   - import "./file.js"
 *   + // import "./file.js"
 *   ```
 * - wait 500ms, ensure background body color is undefined/transparent
 * - Update import_type_css/main.js
 *   ```diff
 *   - // import "./file.js"
 *   + import "./file.js"
 *   ```
 *  - wait 500ms, ensure background body color is green
 */
