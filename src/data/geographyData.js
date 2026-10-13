let placeDatasetPromise;

export function loadNationalPlaces() {
  if (!placeDatasetPromise) {
    const base = import.meta.env.BASE_URL || "/";
    placeDatasetPromise = fetch(`${base}data/geography/places-2026.json`)
      .then((response) => {
        if (!response.ok) throw new Error("National geography data is unavailable.");
        return response.json();
      });
  }
  return placeDatasetPromise;
}
