"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import FloatingNav from "./components/FloatingNav";
import JournalIcon from "./components/JournalIcon";
import { goalFromSettings, loadCloudData, saveCloudData } from "./lib/calorie-data";

type MealItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  caloriesPerUnit: number;
};

type Meal = {
  id: string;
  dateKey: string;
  time: string;
  name: string;
  note: string;
  calories: number;
  low: number;
  high: number;
  confidence: "High" | "Medium";
  assumption: string;
  items: MealItem[];
};

type Draft = Omit<Meal, "id" | "dateKey" | "time" | "note">;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compressPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1280 / longestSide, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("This browser could not prepare the photo."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That photo format could not be read. Please try another image."));
    };

    image.src = objectUrl;
  });
}

export default function Home() {
  const [goal, setGoal] = useState(1900);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [todayLabel, setTodayLabel] = useState("TODAY");
  const [estimateError, setEstimateError] = useState("");
  const cameraInput = useRef<HTMLInputElement>(null);

  const todayKey = dateKey(new Date());
  const todaysMeals = meals.filter((meal) => meal.dateKey === todayKey);
  const consumed = todaysMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const remaining = Math.max(goal - consumed, 0);


  useEffect(() => {
    setTodayLabel(
      new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }).format(new Date()).toUpperCase().replace(",", " ·"),
    );

    void loadCloudData()
      .then((data) => {
        setMeals(data.meals);
        setGoal(goalFromSettings(data.settings));
      })
      .catch((error) => setEstimateError(error instanceof Error ? error.message : "Your saved meals could not be opened."));
  }, []);

  async function beginEstimate(text: string, imageDataUrl?: string) {
    const cleanText = text.trim();
    if (!cleanText) return;
    setEstimateError("");
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: cleanText, imageDataUrl }),
      });
      const result = await response.json() as {
        error?: string;
        name?: string;
        items?: Omit<MealItem, "id">[];
        totalCalories?: number;
        lowEstimate?: number;
        highEstimate?: number;
        confidence?: "High" | "Medium";
        assumption?: string;
      };

      if (!response.ok || !result.items?.length) {
        throw new Error(result.error || "The meal could not be estimated.");
      }

      setDraft({
        name: result.name || cleanText,
        items: result.items.map((item, index) => ({ ...item, id: `ai-${Date.now()}-${index}` })),
        calories: result.totalCalories ?? 0,
        low: result.lowEstimate ?? 0,
        high: result.highEstimate ?? 0,
        confidence: result.confidence ?? "Medium",
        assumption: result.assumption || "Typical portions and preparation were assumed.",
      });
    } catch (error) {
      setEstimateError(error instanceof Error ? error.message : "The meal could not be estimated.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function submitMeal(event: FormEvent) {
    event.preventDefault();
    void beginEstimate(description);
  }

  async function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (file.size > 20 * 1024 * 1024) {
      setEstimateError("Please choose a photo smaller than 20 MB.");
      return;
    }

    setEstimateError("");
    setIsAnalyzing(true);
    try {
      const imageDataUrl = await compressPhoto(file);
      // Anything already typed rides along with the photo. Stating the portions
      // or the cooking fat is the single largest accuracy win available here, so
      // never drop the note just because an image is present.
      const note = description.trim();
      await beginEstimate(note || "Identify and estimate the meal shown in this photo.", imageDataUrl);
    } catch (error) {
      setEstimateError(error instanceof Error ? error.message : "The photo could not be prepared.");
      setIsAnalyzing(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;

    const now = new Date();
    const newMeal: Meal = {
      ...draft,
      id: String(now.getTime()),
      dateKey: dateKey(now),
      time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
      note: `Meal · ${draft.confidence.toLowerCase()} confidence`,
    };
    const nextMeals = [newMeal, ...meals];
    setIsSaving(true);
    setEstimateError("");
    try {
      const saved = await saveCloudData({ meals: nextMeals });
      setMeals(saved.meals);
      setDescription("");
      setDraft(null);
    } catch (error) {
      setEstimateError(error instanceof Error ? error.message : "This meal could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  function changeItemQuantity(itemId: string, change: number) {
    setDraft((current) => {
      if (!current) return current;
      const items = current.items.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(1, item.quantity + change) } : item,
      );
      const calories = items.reduce((sum, item) => sum + item.quantity * item.caloriesPerUnit, 0);
      return {
        ...current,
        items,
        calories,
        low: Math.round(calories * 0.84),
        high: Math.round(calories * 1.22),
      };
    });
  }

  function renameItem(itemId: string, name: string) {
    setDraft((current) => current ? {
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, name } : item),
    } : current);
  }

  return (
    <main className="app-shell" id="today">
      <section className="hero" aria-labelledby="welcome-heading">
        <header className="topbar">
          <p>{todayLabel}</p>
          <Link className="profile-button" aria-label="Open profile settings" href="/settings">GN</Link>
        </header>

        <div className="welcome">
          <h1 id="welcome-heading">Today</h1>
        </div>

        <div className="calorie-figure">
          <section className="calorie-orb" aria-label={consumed > goal ? `${consumed - goal} calories over target` : `${remaining} calories remaining`}>
            <div className="orb-content">
              <p>{consumed > goal ? "Over target" : "Calories left"}</p>
              <strong>{(consumed > goal ? consumed - goal : remaining).toLocaleString()}</strong>
              <span className="orb-unit">kcal</span>
            </div>
          </section>
        </div>
        <div className="daily-totals">
          <div><span className="accent-dot" aria-hidden="true" /><span>Eaten</span><strong>{consumed.toLocaleString()}</strong></div>
          <div><span>Daily target</span><strong>{goal.toLocaleString()}</strong></div>
        </div>
        <label className="composer-label" htmlFor="meal-description">What did you eat?</label>
        <form className="meal-composer" onSubmit={submitMeal}>
          <label className="sr-only" htmlFor="meal-description">Describe what you ate</label>
          <div className="text-entry">
            <input
              id="meal-description"
              name="meal-description"
              placeholder="Describe what you ate…"
              autoComplete="off"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <button type="submit" className="send-button" aria-label="Estimate calories" disabled={!description.trim()}><JournalIcon name="arrow" /></button>
          </div>
          <button
            type="button"
            className="camera-button"
            aria-label={description.trim() ? "Add a photo to this description" : "Choose a meal photo"}
            onClick={() => cameraInput.current?.click()}
          >
            <JournalIcon name="camera" />
          </button>
          <input ref={cameraInput} className="file-input" type="file" accept="image/*" capture="environment" onChange={selectPhoto} />
        </form>

        {description.trim() && !estimateError && (
          <p className="composer-hint">A photo now will be read together with your note.</p>
        )}

        {estimateError && <p className="estimate-error" role="alert">{estimateError}</p>}

        <Link className="journal-link" href="/logs">View your meal log <span aria-hidden="true">↗</span></Link>
      </section>

      <FloatingNav active="home" />

      {isAnalyzing && (
        <div className="analysis-overlay" role="status" aria-live="polite">
          <div className="analysis-pulse" />
          <p>Reading your meal</p>
          <span>Estimating portions and calories…</span>
        </div>
      )}

      {draft && (
        <div className="sheet-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setDraft(null)}>
          <section className="review-sheet" role="dialog" aria-modal="true" aria-labelledby="review-title">
            <div className="sheet-handle" />
            <div className="review-heading">
              <div>
                <p className="section-label">AI ESTIMATE</p>
                <h2 id="review-title">Review this meal</h2>
              </div>
              <button type="button" className="close-button" aria-label="Close review" onClick={() => setDraft(null)}>×</button>
            </div>

            <label className="field-label" htmlFor="review-name">Meal</label>
            <input id="review-name" className="review-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />

            <div className="detected-heading">
              <div>
                <p className="section-label">DETECTED ITEMS</p>
                <span>Adjust anything the estimate got wrong</span>
              </div>
              <strong>{draft.items.length} items</strong>
            </div>

            <div className="detected-list">
              {draft.items.map((item) => (
                <div className="detected-item" key={item.id}>
                  <div className="detected-copy">
                    <input aria-label={`${item.name} name`} value={item.name} onChange={(event) => renameItem(item.id, event.target.value)} />
                    <span>{item.caloriesPerUnit} kcal per {item.unit}</span>
                  </div>
                  <div className="quantity-control" aria-label={`${item.name} quantity`}>
                    <button type="button" aria-label={`Reduce ${item.name}`} onClick={() => changeItemQuantity(item.id, -1)}>−</button>
                    <strong>{item.quantity}</strong>
                    <button type="button" aria-label={`Add ${item.name}`} onClick={() => changeItemQuantity(item.id, 1)}>+</button>
                  </div>
                  <span className="item-unit">{item.unit}{item.quantity === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>

            <div className="estimate-block">
              <div>
                <label htmlFor="review-calories">Estimated calories</label>
                <div className="calorie-input-wrap">
                  <input
                    id="review-calories"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={draft.calories}
                    onChange={(event) => setDraft({ ...draft, calories: Math.max(Number(event.target.value), 0) })}
                  />
                  <span>kcal</span>
                </div>
              </div>
              <div className="confidence-chip">{draft.confidence} confidence</div>
            </div>

            <div className="range-row">
              <span>Likely range</span>
              <strong>{draft.low}–{draft.high} kcal</strong>
            </div>

            <div className="assumption-card">
              <p className="section-label">ASSUMPTION</p>
              <p>{draft.assumption}</p>
            </div>

            <p className="prototype-note">AI estimate—review visible items and quantities before saving.</p>
            <div className="sheet-actions">
              <button type="button" className="secondary-button" onClick={() => setDraft(null)}>Cancel</button>
              <button type="button" className="save-button" disabled={isSaving} onClick={() => void saveDraft()}>{isSaving ? "Saving…" : "Add to today"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
