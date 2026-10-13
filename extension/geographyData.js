/* global chrome */
let geographyPromise;

export function loadExtensionPlaces() {
  if (!geographyPromise) {
    geographyPromise = fetch(chrome.runtime.getURL("data/geography/places-2026.json"))
      .then((response) => {
        if (!response.ok) throw new Error("National geography data is unavailable.");
        return response.json();
      });
  }
  return geographyPromise;
}
