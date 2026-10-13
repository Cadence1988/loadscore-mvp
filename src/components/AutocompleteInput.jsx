import { useEffect, useId, useMemo, useRef, useState } from "react";
import { priorityFreightCities } from "../data/cities";
import { loadNationalPlaces } from "../data/geographyData";
import { normalizePlaceText, searchPlaces } from "../logic/geographyCore";

const priorityNames = new Set(priorityFreightCities.map((city) => normalizePlaceText(city)));

export default function AutocompleteInput({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dataset, setDataset] = useState(null);
  const [dataStatus, setDataStatus] = useState("idle");
  const wrapperRef = useRef(null);
  const listId = useId();

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];

    return dataset ? searchPlaces(dataset, query, priorityNames, 10) : [];
  }, [dataset, value]);

  function ensureDataset() {
    if (dataset || dataStatus === "loading") return;
    setDataStatus("loading");
    loadNationalPlaces()
      .then((loaded) => { setDataset(loaded); setDataStatus("ready"); })
      .catch(() => setDataStatus("error"));
  }

  useEffect(() => {
    function handleOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleChange(e) {
    onChange(e.target.value);
    ensureDataset();
    setOpen(true);
    setHighlightedIndex(-1);
  }

  function handleSelect(place) {
    onChange(place.displayName);
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) setOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((current) =>
        current >= suggestions.length - 1 ? 0 : current + 1,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1,
      );
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  }

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { ensureDataset(); if (value.length > 0) setOpen(true); }}
        placeholder={placeholder}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={listId}
        aria-activedescendant={
          highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined
        }
      />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-dropdown" id={listId} role="listbox">
          {suggestions.map((place, index) => (
            <li
              key={place.id}
              id={`${listId}-${index}`}
              className={`autocomplete-item ${index === highlightedIndex ? "highlighted" : ""}`}
              onMouseDown={() => handleSelect(place)}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="option"
              aria-selected={index === highlightedIndex}
            >
              {place.displayName}
            </li>
          ))}
        </ul>
      )}
      {open && dataStatus === "loading" && <small className="autocomplete-status" role="status">Loading national places…</small>}
      {open && dataStatus === "error" && <small className="autocomplete-status error" role="status">Place suggestions are temporarily unavailable. Your entry is preserved.</small>}
    </div>
  );
}
