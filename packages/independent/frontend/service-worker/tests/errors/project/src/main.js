/* globals window, document */
import {
  createServiceWorkerFacade,
  navigatorControllerRef,
  pwaLogger,
} from "@jsenv/pwa";

pwaLogger.setOptions({
  logLevel: "debug",
});

export const swFacade = createServiceWorkerFacade({
  autoclaimOnFirstActivation: true,
});

const controllerSpan = document.querySelector("#controller");
navigatorControllerRef.subscribe((controller) => {
  if (controller) {
    controllerSpan.innerHTML = `${controller.meta.name}`;
  } else {
    controllerSpan.innerHTML = "no";
  }
});

build: {
  const buildNoErrorButton = document.querySelector("#build_no_error");
  buildNoErrorButton.onclick = async () => {
    buildNoErrorButton.disabled = true;
    await fetch("/build_no_error");
    buildNoErrorButton.disabled = false;
  };
  const buildErrorDuringRegisterButton = document.querySelector(
    "#build_error_during_register",
  );
  buildErrorDuringRegisterButton.onclick = async () => {
    buildErrorDuringRegisterButton.disabled = true;
    await fetch("/build_error_during_register");
    buildErrorDuringRegisterButton.disabled = false;
  };
  const buildErrorDuringInstallButton = document.querySelector(
    "#build_error_during_install",
  );
  buildErrorDuringInstallButton.onclick = async () => {
    buildErrorDuringInstallButton.disabled = true;
    await fetch("/build_error_during_install");
    buildErrorDuringInstallButton.disabled = false;
  };
  const buildErrorDuringActivateButton = document.querySelector(
    "#build_error_during_activate",
  );
  buildErrorDuringActivateButton.onclick = async () => {
    buildErrorDuringActivateButton.disabled = true;
    await fetch("/build_error_during_activate");
    buildErrorDuringActivateButton.disabled = false;
  };
}

registration: {
  const registerButton = document.querySelector("#register");
  registerButton.disabled = false;
  registerButton.onclick = async () => {
    registerButton.disabled = true;
    try {
      const registrationPromise =
        window.navigator.serviceWorker.register("./sw.js");
      swFacade.setRegistrationPromise(registrationPromise);
      await registrationPromise;
    } finally {
      registerButton.disabled = false;
    }
  };

  // in practice there will be no such UI, it's only for dev 99% of the time
  const unregisterButton = document.querySelector("#unregister");
  unregisterButton.disabled = false;
  unregisterButton.onclick = async () => {
    unregisterButton.disabled = true;
    try {
      await swFacade.unregister();
    } finally {
      unregisterButton.disabled = false;
    }
  };

  // toggle ui based on readyState
  const setReadyStateUI = (element) => {
    const readyStateUIContainer = document.querySelector("#ready_state");
    readyStateUIContainer.innerHTML = "";
    readyStateUIContainer.appendChild(element.cloneNode(true));
  };
  const errorUI = document.querySelector("#error");
  swFacade.subscribe(({ error }) => {
    errorUI.innerHTML = error ? "Failed to register service worker script" : "";
    if (error) {
      setReadyStateUI(errorUI);
    }
  });
  const installingUI = document.querySelector("#installing");
  swFacade.subscribe(({ readyState, meta }) => {
    if (readyState === "installing") {
      installingUI.querySelector("span").innerHTML =
        `installing ${meta.name}...`;
      setReadyStateUI(installingUI);
    }
  });
  const installedUI = document.querySelector("#installed");
  swFacade.subscribe(({ readyState, meta }) => {
    if (readyState === "installed") {
      installedUI.querySelector("span").innerHTML = `${meta.name} installed`;
      setReadyStateUI(installedUI);
    }
  });
  const activatingUI = document.querySelector("#activating");
  swFacade.subscribe(({ readyState, meta }) => {
    if (readyState === "activating") {
      activatingUI.querySelector("span").innerHTML =
        `activating ${meta.name}...`;
      setReadyStateUI(activatingUI);
    }
  });
  const activatedUI = document.querySelector("#activated");
  swFacade.subscribe(({ readyState, meta }) => {
    if (readyState === "activated") {
      activatedUI.querySelector("span").innerHTML = `${meta.name} activated`;
      setReadyStateUI(activatedUI);
    }
  });
  const redundantUI = document.querySelector("#redundant");
  swFacade.subscribe(({ readyState, meta }) => {
    if (readyState === "redundant") {
      redundantUI.querySelector("span").innerHTML = `${meta.name} redundant`;
      setReadyStateUI(redundantUI);
    }
  });
  swFacade.subscribe(({ readyState }) => {
    if (readyState === "") {
      setReadyStateUI(document.createTextNode(""));
    }
  });

  // install instrumentation
  const installResolveButton = document.querySelector("#resolve_install");
  installResolveButton.onclick = () => {
    swFacade.sendMessage({ action: "resolve_install" });
  };
  const installRejectButton = document.querySelector("#reject_install");
  installRejectButton.onclick = () => {
    swFacade.sendMessage({ action: "reject_install" });
  };
  swFacade.subscribe(({ meta }) => {
    const { installInstrumentation } = meta;
    installResolveButton.disabled = !installInstrumentation;
    installRejectButton.disabled = !installInstrumentation;
  });

  // activate instrumentation
  const activateResolveButton = document.querySelector("#resolve_activate");
  activateResolveButton.onclick = () => {
    swFacade.sendMessage({ action: "resolve_activate" });
  };
  const activateRejectButton = document.querySelector("#reject_activate");
  activateRejectButton.onclick = () => {
    swFacade.sendMessage({ action: "reject_activate" });
  };
  swFacade.subscribe(({ meta }) => {
    const { activateInstrumentation } = meta;
    activateResolveButton.disabled = !activateInstrumentation;
    activateRejectButton.disabled = !activateInstrumentation;
  });
}

update: {
  const updateCheckButton = document.querySelector("#update_check_button");
  updateCheckButton.disabled = false;
  updateCheckButton.onclick = async () => {
    updateCheckButton.disabled = true;
    try {
      const update = await swFacade.checkForUpdates();
      if (!update) {
        // eslint-disable-next-line no-alert
        window.alert("there is no update available");
      }
    } finally {
      updateCheckButton.disabled = false;
    }
  };

  const setUpdateReadyStateUI = (element) => {
    const updateReadyStateUIContainer = document.querySelector(
      "#update_ready_state",
    );
    updateReadyStateUIContainer.innerHTML = "";
    updateReadyStateUIContainer.appendChild(element.cloneNode(true));
  };

  const updateRegisterErrorUI = document.querySelector("#update_error");
  swFacade.subscribe(({ update }) => {
    const isUpdateError = update.error && update.readyState === "";
    if (isUpdateError) {
      updateRegisterErrorUI.innerHTML = `Error while trying to register updated version of service worker script`;
      setUpdateReadyStateUI(updateRegisterErrorUI);
    }
  });

  const updateInstallingUI = document.querySelector("#update_installing");
  const updateResolveInstallButton = document.querySelector(
    "#update_resolve_install",
  );
  const updateRejectInstallButton = document.querySelector(
    "#update_reject_install",
  );
  updateResolveInstallButton.onclick = () => {
    swFacade.sendMessage({ action: "resolve_install" });
  };
  updateRejectInstallButton.onclick = () => {
    swFacade.sendMessage({ action: "reject_install" });
  };

  swFacade.subscribe(({ update }) => {
    if (update.readyState === "installing") {
      updateInstallingUI.querySelector("span").innerHTML =
        `${update.meta.name} is installing...`;
      updateResolveInstallButton.disabled = !update.meta.installInstrumentation;
      updateRejectInstallButton.disabled = !update.meta.installInstrumentation;
      setUpdateReadyStateUI(updateInstallingUI);
    }
  });

  const updateInstalledUI = document.querySelector("#update_installed");
  const updateByRestartButton = document.querySelector(
    "#update_by_restart_button",
  );
  updateByRestartButton.onclick = async () => {
    updateByRestartButton.disabled = true;
    await swFacade.activateUpdate();
  };
  const updateNowButton = document.querySelector("#update_now_button");
  updateNowButton.onclick = async () => {
    await swFacade.activateUpdate();
  };
  swFacade.subscribe(({ update }) => {
    if (update.readyState === "installed") {
      updateByRestartButton.disabled = !update.reloadRequired;
      updateNowButton.disabled = update.reloadRequired;
      updateInstalledUI.querySelector("span").innerHTML =
        `${update.meta.name} installed`;
      setUpdateReadyStateUI(updateInstalledUI);
    }
  });

  const updateActivatingUI = document.querySelector("#update_activating");
  const updateResolveActivateButton = document.querySelector(
    "#update_resolve_activate",
  );
  const updateRejectActivateButton = document.querySelector(
    "#update_reject_activate",
  );
  updateResolveActivateButton.onclick = () => {
    swFacade.sendMessage({ action: "resolve_activate" });
  };
  updateRejectActivateButton.onclick = () => {
    swFacade.sendMessage({ action: "reject_activate" });
  };
  swFacade.subscribe(({ update }) => {
    if (update.readyState === "activating") {
      updateActivatingUI.querySelector("span").innerHTML =
        `activating ${update.meta.name}...`;
      updateResolveActivateButton.disabled =
        !update.meta.activateInstrumentation;
      updateRejectActivateButton.disabled =
        !update.meta.activateInstrumentation;
      setUpdateReadyStateUI(updateActivatingUI);
    }
  });

  const udpateActivatedUI = document.querySelector("#update_activated");
  swFacade.subscribe(({ update }) => {
    if (update.readyState === "activated") {
      udpateActivatedUI.querySelector("span").innerHTML =
        `${update.meta.name} activated`;
      setUpdateReadyStateUI(udpateActivatedUI);
    }
  });

  const udpateRedundantUI = document.querySelector("#update_redundant");
  swFacade.subscribe(({ update }) => {
    if (update.readyState === "redundant") {
      udpateRedundantUI.querySelector("span").innerHTML =
        `${update.meta.name} redundant`;
      setUpdateReadyStateUI(udpateRedundantUI);
    }
  });

  swFacade.subscribe(({ update }) => {
    if (update.readyState === "") {
      setUpdateReadyStateUI(document.createTextNode(""));
    }
  });
}
