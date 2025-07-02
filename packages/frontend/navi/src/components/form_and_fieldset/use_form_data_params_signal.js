import { useActionParamsSignal } from "../use_action_params_signal.js";

export const useFormDataParamsSignal = (initialParams = {}) => {
  const paramsSignal = useActionParamsSignal(initialParams);

  return [
    paramsSignal,
    (formData) => {
      const params = {};
      for (const [name, value] of formData) {
        if (name in params) {
          if (Array.isArray(params[name])) {
            params[name].push(value);
          } else {
            params[name] = [params[name], value];
          }
        } else {
          params[name] = value;
        }
      }
      paramsSignal.value = params;
    },
  ];
};
