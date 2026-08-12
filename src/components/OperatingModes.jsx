import AlertPreferences from "./AlertPreferences";
import { MODE_DEFINITIONS, MODE_ORDER } from "../logic/operatingModes";

export default function OperatingModes({ configuration, onModeSelect, onRuleChange }) {
  const active = configuration.activeMode;
  return (
    <section className="operating-modes" aria-labelledby="operating-modes-title">
      <div className="operating-heading">
        <div><p className="eyebrow">Driver-controlled decision layer</p><h2 id="operating-modes-title">Operating Mode</h2></div>
        <span className="local-only">No automatic switching</span>
      </div>
      <p>Choose how selective you want LoadScore to be right now. Your underlying LoadScore calculation never changes.</p>
      <div className="mode-picker">
        {MODE_ORDER.map((id) => (
          <button type="button" className={active === id ? "active" : ""} onClick={() => onModeSelect(id)} key={id}>
            <strong>{MODE_DEFINITIONS[id].name}</strong><span>{MODE_DEFINITIONS[id].description}</span>
          </button>
        ))}
      </div>
      <AlertPreferences targets={{ ...configuration.modes[active], ...configuration.globalDestinations }} onChange={onRuleChange} modeName={MODE_DEFINITIONS[active].name} />
      <p className="mode-default-note">Flexible and Recovery starter values are editable LoadScore defaults—not industry standards or financial advice. Avoided destinations remain global across all modes.</p>
    </section>
  );
}
