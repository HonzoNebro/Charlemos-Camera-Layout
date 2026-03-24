import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";

function readHideControlsPreference() {
  return game.settings.get(MODULE_ID, SETTINGS_KEYS.HIDE_CONTROLS);
}

function applyBodyClass(shouldHide) {
  document.body.classList.toggle("charlemos-hide-controls", Boolean(shouldHide));
}

export function initializeUiControls() {
  const shouldHide = readHideControlsPreference();
  applyBodyClass(shouldHide);
  console.debug(`${MODULE_ID} | ui controls initialized`, { shouldHide });
}

export function setControlsVisibility(visible) {
  const shouldHide = !visible;
  applyBodyClass(shouldHide);
  game.settings.set(MODULE_ID, SETTINGS_KEYS.HIDE_CONTROLS, shouldHide);
}
