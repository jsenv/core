import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";

export const generateFieldInvalidMessage = (key, { field, ...vars } = {}) => {
  return naviI18n(key, {
    field: () => generateThisFieldText(field),
    ...vars,
  });
};

const generateThisFieldText = (field) => {
  if (field.type === "password") {
    return naviI18n("constraint.field.password");
  }
  if (field.type === "email") {
    return naviI18n("constraint.field.email");
  }
  if (field.type === "checkbox") {
    return naviI18n("constraint.field.checkbox");
  }
  if (field.type === "radio") {
    return naviI18n("constraint.field.radio");
  }
  return naviI18n("constraint.field.default");
};
