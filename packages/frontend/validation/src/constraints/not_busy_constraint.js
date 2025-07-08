export const NOT_BUSY_CONSTRAINT = {
  name: "not_busy",
  check: (element) => {
    if (element.getAttribute("aria-busy") === "true") {
      if (
        element.tagName === "BUTTON" &&
        element.form &&
        element.form.hasAttribute("data-allow-concurrent-actions")
      ) {
        return null;
      }
      const busyMessage = element.getAttribute("data-busy-message");
      return {
        message:
          busyMessage || `Cette action est en cours. Veuillez patienter.`,
        level: "info",
      };
    }
    return null;
  },
};
