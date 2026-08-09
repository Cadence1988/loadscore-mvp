import { useState } from "react";

export default function DriverProfiles({
  profiles,
  form,
  targets,
  onTargetChange,
  onSave,
  onApply,
  onDelete,
}) {
  const [profileName, setProfileName] = useState("");

  function saveProfile() {
    const name = profileName.trim();
    if (!name) return;
    onSave({
      id: crypto.randomUUID(),
      name,
      mpg: form.mpg,
      fuelPrice: form.fuelPrice,
      fixedCostPerMile: form.fixedCostPerMile,
      targetAllInRpm: targets.targetAllInRpm,
      targetProfit: targets.targetProfit,
      minimumLoadScore: targets.minimumLoadScore,
    });
    setProfileName("");
  }

  return (
    <section className="profile-section" aria-labelledby="profile-title">
      <div className="profile-heading">
        <div>
          <p className="eyebrow">Phase 8</p>
          <h2 id="profile-title">Driver Profiles</h2>
          <p>Save truck costs and decision targets, then apply them with one click.</p>
        </div>
        <div className="profile-create">
          <input
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveProfile();
              }
            }}
            placeholder="Profile name"
            aria-label="New profile name"
          />
          <button type="button" onClick={saveProfile} disabled={!profileName.trim()}>
            Save current setup
          </button>
        </div>
      </div>

      <label className="alert-preference">
        Load alert threshold
        <input
          type="number"
          min="0"
          max="100"
          value={targets.minimumLoadScore}
          onChange={(event) => onTargetChange("minimumLoadScore", event.target.value)}
        />
        <span>Saved comparison loads at or above this score are marked as matches.</span>
      </label>

      {profiles.length === 0 ? (
        <div className="profile-empty">No profiles saved on this device yet.</div>
      ) : (
        <div className="profile-list">
          {profiles.map((profile) => (
            <article key={profile.id}>
              <div>
                <strong>{profile.name}</strong>
                <span>
                  {profile.mpg} MPG · ${profile.fixedCostPerMile}/mi · Target ${profile.targetAllInRpm}/mi
                </span>
              </div>
              <div className="profile-actions">
                <button type="button" onClick={() => onApply(profile)}>Apply</button>
                <button className="delete-profile" type="button" onClick={() => onDelete(profile.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="local-note">Profiles are stored only in this browser for the MVP.</p>
    </section>
  );
}
