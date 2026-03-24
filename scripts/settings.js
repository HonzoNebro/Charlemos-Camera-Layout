import { MODULE_ID, SETTINGS_KEYS } from "./constants.js";
import { CameraConfigApp } from "./camera-config-app.js";

function registerPlayerLayoutsSetting() {
  game.settings.register(MODULE_ID, SETTINGS_KEYS.PLAYER_LAYOUTS, {
    name: `${MODULE_ID}.settings.playerLayouts.name`,
    hint: `${MODULE_ID}.settings.playerLayouts.hint`,
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
}

function registerSceneCameraSetting() {
  game.settings.register(MODULE_ID, SETTINGS_KEYS.SCENE_CAMERA, {
    name: `${MODULE_ID}.settings.sceneCamera.name`,
    hint: `${MODULE_ID}.settings.sceneCamera.hint`,
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
}

function registerSceneProfilesSetting() {
  game.settings.register(MODULE_ID, SETTINGS_KEYS.SCENE_PROFILES, {
    name: `${MODULE_ID}.settings.sceneProfiles.name`,
    hint: `${MODULE_ID}.settings.sceneProfiles.hint`,
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });
}

function registerHideControlsSetting() {
  game.settings.register(MODULE_ID, SETTINGS_KEYS.HIDE_CONTROLS, {
    name: `${MODULE_ID}.settings.hideControls.name`,
    hint: `${MODULE_ID}.settings.hideControls.hint`,
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    onChange: (value) => {
      document.body.classList.toggle("charlemos-hide-controls", Boolean(value));
    }
  });
}

function registerDebugRendererSetting() {
  game.settings.register(MODULE_ID, SETTINGS_KEYS.DEBUG_RENDERER, {
    name: `${MODULE_ID}.settings.debugRenderer.name`,
    hint: `${MODULE_ID}.settings.debugRenderer.hint`,
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });
}

function registerConfigMenu() {
  game.settings.registerMenu(MODULE_ID, "configMenu", {
    name: `${MODULE_ID}.settings.configMenu.name`,
    label: `${MODULE_ID}.settings.configMenu.label`,
    hint: `${MODULE_ID}.settings.configMenu.hint`,
    icon: "fa-solid fa-video",
    type: CameraConfigApp,
    restricted: true
  });
}

export function registerSettings() {
  registerConfigMenu();
  registerPlayerLayoutsSetting();
  registerSceneCameraSetting();
  registerSceneProfilesSetting();
  registerHideControlsSetting();
  registerDebugRendererSetting();
  console.debug(`${MODULE_ID} | settings registered`);
}
