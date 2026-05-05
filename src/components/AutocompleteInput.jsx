import { useEffect, useRef, useState } from "react";
import { marketScores } from "../data/marketScores";

const cities = Object.keys(marketScores);

export default function AutocompleteInput({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const suggestions =
    value.length > 0
      ? cities.filter((c) => c.toLowerCase().includes(value.toLowerCase()))
      : [];

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
  }

  function handleSelect(city) {
    onChange(city);
    setOpen(false);
  }

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        value={value}
        onChange={handleChange}
        onFocus={() => value.length > 0 && setOpen(true)}
        placeholder={placeholder}
      />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-dropdown">
          {suggestions.map((city) => (
            <li
              key={city}
              className="autocomplete-item"
              onMouseDown={() => handleSelect(city)}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
