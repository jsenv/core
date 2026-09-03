import { createImportMetaHot } from "/@fs@jsenv/core/src/plugins/import_meta_hot/client/import_meta_hot.js";import.meta.hot = createImportMetaHot(import.meta.url);import { installImportMetaCssDev as __installImportMetaCssDev__ } from "/@fs@jsenv/core/src/plugins/import_meta_css/client/import_meta_css_dev.js";const remove = __installImportMetaCssDev__(import.meta);if (import.meta.hot) {  import.meta.hot.dispose(() => {    remove();  });}export const setBodyColor = (color) => {
  import.meta.css = /* css */ `body {
  color: ${color};
}
`;
};

//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImZpbGU6Ly8vVXNlcnMvZG1haWwvRG9jdW1lbnRzL2Rldi9qc2Vudi9jb3JlL3Rlc3RzL2Rldl9hbmRfYnVpbGQvaW1wb3J0X21ldGFfY3NzL2NsaWVudC9iLmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCBzZXRCb2R5Q29sb3IgPSAoY29sb3IpID0+IHtcbiAgaW1wb3J0Lm1ldGEuY3NzID0gLyogY3NzICovIGBcbiAgICBib2R5IHtcbiAgICAgIGNvbG9yOiAke2NvbG9yfTtcbiAgICB9XG4gIGA7XG59O1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3ZDLENBQUMsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQUE7QUFBQTtBQUFBLENBSTNCO0FBQ0gsQ0FBQzsifQ==
