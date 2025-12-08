export const CONFIRM_CONSTRAINT = {
  name: "confirm",
  // messageAttribute: "data-confirm-message",
  check: (field) => {
    const messageAttribute = field.getAttribute("data-confirm");
    if (!messageAttribute) {
      return "";
    }
    // eslint-disable-next-line no-alert
    if (window.confirm(messageAttribute)) {
      return "";
    }
    return "";
  },
};
