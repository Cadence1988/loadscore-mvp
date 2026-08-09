import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cities } from "../data/cities";

export default function AutocompleteInput({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const listId = useId();

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return [];

    return cities
      .filter((city) => city.toLowerCase().includes(query))
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(query);
        const bStarts = b.toLowerCase().startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.localeCompare(b);
      })
      .slice(0, 10);
  }, [value]);

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
    setOpen(true);
    setHighlightedIndex(-1);
  }

  function handleSelect(city) {
    onChange(city);
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
        onFocus={() => value.length > 0 && setOpen(true)}
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
          {suggestions.map((city, index) => (
            <li
              key={city}
              id={`${listId}-${index}`}
              className={`autocomplete-item ${index === highlightedIndex ? "highlighted" : ""}`}
              onMouseDown={() => handleSelect(city)}
              onMouseEnter={() => setHighlightedIndex(index)}
              role="option"
              aria-selected={index === highlightedIndex}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
