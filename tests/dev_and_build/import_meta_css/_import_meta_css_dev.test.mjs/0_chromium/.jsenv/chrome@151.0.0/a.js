import { createImportMetaHot } from "/@fs@jsenv/core/src/plugins/import_meta_hot/client/import_meta_hot.js";import.meta.hot = createImportMetaHot(import.meta.url);import { installImportMetaCssDev as __installImportMetaCssDev__ } from "/@fs@jsenv/core/src/plugins/import_meta_css/client/import_meta_css_dev.js";const remove = __installImportMetaCssDev__(import.meta);if (import.meta.hot) {  import.meta.hot.dispose(() => {    remove();  });}export const setBodyBackgroundColor = (color) => {
  import.meta.css = /* css */ `body {
  background-color: ${color};
}
`;
};

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vVXNlcnMvZG1haWwvRG9jdW1lbnRzL2Rldi9qc2Vudi9jb3JlL3Rlc3RzL2Rldl9hbmRfYnVpbGQvaW1wb3J0X21ldGFfY3NzL2NsaWVudC9hLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCBzZXRCb2R5QmFja2dyb3VuZENvbG9yID0gKGNvbG9yKSA9PiB7XG4gIGltcG9ydC5tZXRhLmNzcyA9IC8qIGNzcyAqLyBgXG4gICAgYm9keSB7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAke2NvbG9yfTtcbiAgICB9XG4gIGA7XG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sQ0FBQyxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDakQsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFBQTtBQUFBO0FBQUEsQ0FJM0I7QUFDSCxDQUFDOyJ9
