"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CalorieSettings as Settings } from "../lib/calorie-data";
import { loadCloudData, saveCloudData } from "../lib/calorie-data";

const defaults: Settings = {
  maintenance: 2150,
  deficit: 250,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const dailyTarget = Math.max(settings.maintenance - settings.deficit, 500);

  useEffect(() => {
    void loadCloudData()
      .then((data) => data.settings && setSettings(data.settings))
      .catch((error) => setSaveError(error instanceof Error ? error.message : "Your settings could not be opened."));
  }, []);

  async function saveSettings() {
    const safeSettings = {
      maintenance: Math.max(Math.round(settings.maintenance), 500),
      deficit: Math.max(Math.round(settings.deficit), 0),
    };
    setSaving(true);
    setSaveError("");
    try {
      const result = await saveCloudData({ settings: safeSettings });
      setSettings(result.settings || safeSettings);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Your settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="settings-shell">
      <header className="settings-topbar">
        <Link href="/" aria-label="Return to Today">←</Link>
        <p>SETTINGS</p>
        <span aria-hidden="true" />
      </header>

      <section className="settings-intro">
        <p>Your daily rhythm</p>
        <h1>Set the target.</h1>
        <span>Start with the maintenance number you already know. You can change this whenever your plan changes.</span>
      </section>

      <section className="target-preview" aria-label={`${dailyTarget} calorie daily target`}>
        <p>DAILY TARGET</p>
        <strong>{dailyTarget.toLocaleString()}</strong>
        <span>kcal</span>
      </section>

      <section className="settings-form" aria-labelledby="numbers-heading">
        <div className="settings-section-heading">
          <p>YOUR NUMBERS</p>
          <h2 id="numbers-heading">Calorie plan</h2>
        </div>

        <label className="number-field">
          <span>
            <strong>Maintenance calories</strong>
            <small>Your estimated calories to maintain weight</small>
          </span>
          <div>
            <input
              type="number"
              min="500"
              max="10000"
              inputMode="numeric"
              value={settings.maintenance}
              onChange={(event) => setSettings({ ...settings, maintenance: Number(event.target.value) })}
            />
            <small>kcal</small>
          </div>
        </label>

        <div className="deficit-field">
          <div className="deficit-label">
            <span>
              <strong>Daily deficit</strong>
              <small>Subtracted from maintenance</small>
            </span>
            <b>{settings.deficit} kcal</b>
          </div>
          <input
            aria-label="Daily calorie deficit"
            type="range"
            min="0"
            max="750"
            step="50"
            value={settings.deficit}
            onChange={(event) => setSettings({ ...settings, deficit: Number(event.target.value) })}
          />
          <div className="deficit-presets" aria-label="Common deficit choices">
            {[200, 250, 300].map((amount) => (
              <button
                type="button"
                className={settings.deficit === amount ? "active" : ""}
                key={amount}
                onClick={() => setSettings({ ...settings, deficit: amount })}
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        <div className="target-equation">
          <span>{settings.maintenance.toLocaleString()} maintenance</span>
          <b>−</b>
          <span>{settings.deficit} deficit</span>
          <b>=</b>
          <strong>{dailyTarget.toLocaleString()} target</strong>
        </div>

        {saveError && <p className="estimate-error settings-error" role="alert">{saveError}</p>}
        <button type="button" className="settings-save" disabled={saving} onClick={() => void saveSettings()}>
          {saving ? "Saving…" : saved ? "Saved to cloud ✓" : "Save calorie target"}
        </button>
      </section>

      <section className="preferences-preview">
        <div>
          <p>PERSONAL DEFAULTS</p>
          <h2>Teach the estimator your habits</h2>
        </div>
        <span>Coming next</span>
        <p>Usual roti size, milk type, cooking oil and other recurring preferences will live here later.</p>
      </section>
    </main>
  );
}
