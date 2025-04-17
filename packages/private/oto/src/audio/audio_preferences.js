import { computed, effect, signal } from "@preact/signals";

const volumePreferencesSignal = signal({
  music: 1,
  sound: 1,
});
const volumePrefsLocalStorageItem = localStorage.getItem("volume_prefs");
if (volumePrefsLocalStorageItem) {
  volumePreferencesSignal.value = JSON.parse(volumePrefsLocalStorageItem);
}
effect(() => {
  const volumePreferences = volumePreferencesSignal.value;
  localStorage.setItem("volume_prefs", JSON.stringify(volumePreferences));
});

export const musicVolumePreferenceSignal = computed(() => {
  const volumePreferences = volumePreferencesSignal.value;
  return volumePreferences.music;
});
export const setVolumePreferences = ({ music, sound }) => {
  volumePreferencesSignal.value = { music, sound };
};
