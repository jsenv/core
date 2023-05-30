/* eslint-env browser */
import {
  pwaLogger,
  navigatorControllerRef,
  createServiceWorkerFacade,
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
  const buildDogButton = document.querySelector("#build_dog");
  buildDogButton.onclick = async () => {
    buildDogButton.disabled = true;
    await fetch("/update_animal_to_dog");
    buildDogButton.disabled = false;
  };
  const buildHorseButton = document.querySelector("#build_horse");
  buildHorseButton.onclick = async () => {
    buildHorseButton.disabled = true;
    await fetch("/update_animal_to_horse");
    buildHorseButton.disabled = false;
  };
  const buildCatButton = document.querySelector("#build_cat");
  buildCatButton.onclick = async () => {
    buildCatButton.disabled = true;
    await fetch("/update_animal_to_cat");
    buildCatButton.disabled = false;
  };
  const buildBearButton = document.querySelector("#build_bear");
  buildBearButton.onclick = async () => {
    buildBearButton.disabled = true;
    await fetch("/update_animal_to_bear");
    buildBearButton.disabled = false;
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
  const errorUI = document.querySelector("#error");
  swFacade.subscribe(({ error }) => {
    errorUI.style.display = error ? "block" : "none";
    errorUI.innerHTML = error ? error.stack : "";
  });
  const installingUI = document.querySelector("#installing");
  swFacade.subscribe(({ readyState, meta }) => {
    installingUI.style.display = readyState === "installing" ? "block" : "none";
    if (readyState === "installing") {
      installingUI.querySelector(
        "span",
      ).innerHTML = `installing ${meta.name}...`;
    }
  });
  const installedUI = document.querySelector("#installed");
  swFacade.subscribe(({ readyState, meta }) => {
    installedUI.style.display = readyState === "installed" ? "block" : "none";
    if (readyState === "installed") {
      installedUI.querySelector("span").innerHTML = `${meta.name} installed`;
    }
  });
  const activating = document.querySelector("#activating");
  swFacade.subscribe(({ readyState, meta }) => {
    activating.style.display = readyState === "activating" ? "block" : "none";
    if (readyState === "activating") {
      activating.querySelector("span").innerHTML = `activating ${meta.name}...`;
    }
  });
  const activated = document.querySelector("#activated");
  swFacade.subscribe(({ readyState, meta }) => {
    activated.style.display = readyState === "activated" ? "block" : "none";
    if (readyState === "activated") {
      activated.querySelector("span").innerHTML = `${meta.name} activated`;
    }
  });
  const redundant = document.querySelector("#redundant");
  swFacade.subscribe(({ readyState, meta }) => {
    redundant.style.display = readyState === "redundant" ? "block" : "none";
    if (readyState === "redundant") {
      redundant.querySelector("span").innerHTML = `${meta.name} redundant`;
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
    updateInstallingUI.style.display =
      update.readyState === "installing" ? "block" : "none";
    if (update.readyState === "installing") {
      updateInstallingUI.querySelector(
        "span",
      ).innerHTML = `${update.meta.name} is installing...`;
      updateResolveInstallButton.disabled = !update.meta.installInstrumentation;
      updateRejectInstallButton.disabled = !update.meta.installInstrumentation;
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
    updateInstalledUI.style.display =
      update.readyState === "installed" ? "block" : "none";
    if (update.readyState === "installed") {
      updateByRestartButton.disabled = !update.reloadRequired;
      updateNowButton.disabled = update.reloadRequired;
      updateInstalledUI.querySelector(
        "span",
      ).innerHTML = `${update.meta.name} installed`;
    }
  });

  const updateActivating = document.querySelector("#update_activating");
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
    updateActivating.style.display =
      update.readyState === "activating" ? "block" : "none";
    if (update.readyState === "activating") {
      updateActivating.querySelector(
        "span",
      ).innerHTML = `activating ${update.meta.name}...`;
      updateResolveActivateButton.disabled =
        !update.meta.activateInstrumentation;
      updateRejectActivateButton.disabled =
        !update.meta.activateInstrumentation;
    }
  });

  const udpateActivated = document.querySelector("#update_activated");
  swFacade.subscribe(({ update }) => {
    udpateActivated.style.display =
      update.readyState === "activated" ? "block" : "none";
    if (update.readyState === "activated") {
      udpateActivated.querySelector(
        "span",
      ).innerHTML = `${update.meta.name} activated`;
    }
  });

  const udpateRedundant = document.querySelector("#update_redundant");
  swFacade.subscribe(({ update }) => {
    udpateRedundant.style.display =
      update.readyState === "redundant" ? "block" : "none";
    if (update.readyState === "redundant") {
      udpateRedundant.querySelector(
        "span",
      ).innerHTML = `${update.meta.name} redundant`;
    }
  });
}
