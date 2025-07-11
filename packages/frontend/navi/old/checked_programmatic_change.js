const setupCheckedProgrammaticChange = () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "checked",
  );
  Object.defineProperty(HTMLInputElement.prototype, "checked", {
    get() {
      return originalDescriptor.get.call(this);
    },
    set(value) {
      const wasChecked = this.checked;
      const willBeChecked = Boolean(value);
      originalDescriptor.set.call(this, value);
      if (wasChecked === willBeChecked) {
        return;
      }
      if (this.type === "radio" || this.type === "checkbox") {
        this.dispatchEvent(
          new CustomEvent("programmaticchange", {
            bubbles: true,
            detail: { wasChecked, willBeChecked },
          }),
        );
      }
    },
    configurable: true,
  });

  // ✅ Cleanup function
  return () => {
    Object.defineProperty(
      HTMLInputElement.prototype,
      "checked",
      originalDescriptor,
    );
  };
};
setupCheckedProgrammaticChange();
