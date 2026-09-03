"use client";

import { useEffect, useMemo, useState } from "react";
import FloatingNav from "../components/FloatingNav";
import type { Meal } from "../lib/calorie-data";
import { STORAGE_KEY, localDateKey, readMeals } from "../lib/calorie-data";

function readableDate(key: string) {
  const today = localDateKey(new Date());
  if (key === today) return "Today";
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" })
    .format(new Date(`${key}T12:00:00`));
}

export default function LogsPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<Meal | null>(null);

  useEffect(() => {
    setMeals(readMeals());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
  }, [meals, ready]);

  const groups = useMemo(() => {
    const byDate = new Map<string, Meal[]>();
    meals.forEach((meal) => byDate.set(meal.dateKey, [...(byDate.get(meal.dateKey) || []), meal]));
    return [...byDate.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [meals]);

  function changeQuantity(itemId: string, change: number) {
    setEditing((current) => {
      if (!current) return current;
      const items = current.items.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(1, item.quantity + change) } : item,
      );
      const calories = items.reduce((sum, item) => sum + item.quantity * item.caloriesPerUnit, 0);
      return { ...current, items, calories, low: Math.round(calories * 0.84), high: Math.round(calories * 1.22) };
    });
  }

  function saveEdit() {
    if (!editing) return;
    setMeals((current) => current.map((meal) => meal.id === editing.id ? editing : meal));
    setEditing(null);
  }

  return (
    <main className="app-shell page-shell dark-page">
      <section className="log-section page-section" aria-labelledby="log-heading">
        <div className="page-topline">
          <p className="section-label">MEAL HISTORY</p>
          <span>{meals.length} meals</span>
        </div>
        <div className="log-header">
          <div>
            <h1 id="log-heading">Your logs.</h1>
            <p>Every saved meal, newest first.</p>
          </div>
        </div>

        <div className="storage-note" role="status">
          <span aria-hidden="true" />
          {ready ? "Saved on this device" : "Opening your history…"}
        </div>

        {!ready ? null : groups.length === 0 ? (
          <div className="page-empty">
            <strong>No meals yet.</strong>
            <span>Add your first meal from Home and it will appear here.</span>
          </div>
        ) : groups.map(([key, dayMeals]) => {
          const total = dayMeals.reduce((sum, meal) => sum + meal.calories, 0);
          return (
            <section className="log-day" key={key}>
              <div className="log-day-heading">
                <h2>{readableDate(key)}</h2>
                <strong>{total.toLocaleString()} kcal</strong>
              </div>
              <div className="meal-list">
                {dayMeals.map((meal) => (
                  <article className="meal-row" key={meal.id}>
                    <time>{meal.time}</time>
                    <button className="meal-copy meal-open" type="button" onClick={() => setEditing(structuredClone(meal))}>
                      <h3>{meal.name}</h3>
                      <p>{meal.note} · tap to adjust</p>
                    </button>
                    <strong>{meal.calories}</strong>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </section>

      <FloatingNav active="logs" />

      {editing && (
        <div className="sheet-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}>
          <section className="review-sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <div className="sheet-handle" />
            <div className="review-heading">
              <div><p className="section-label">EDIT SAVED MEAL</p><h2 id="edit-title">Correct the estimate</h2></div>
              <button className="close-button" type="button" aria-label="Close" onClick={() => setEditing(null)}>×</button>
            </div>
            <label className="field-label" htmlFor="edit-meal-name">Meal</label>
            <input id="edit-meal-name" className="review-name" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            <div className="detected-heading">
              <div><p className="section-label">ITEMS & QUANTITIES</p><span>Change what the photo got wrong</span></div>
              <strong>{editing.items.length} items</strong>
            </div>
            <div className="detected-list">
              {editing.items.map((item) => (
                <div className="detected-item" key={item.id}>
                  <div className="detected-copy">
                    <input value={item.name} aria-label={`${item.name} name`} onChange={(event) => setEditing({ ...editing, items: editing.items.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry) })} />
                    <span>{item.caloriesPerUnit} kcal per {item.unit}</span>
                  </div>
                  <div className="quantity-control">
                    <button type="button" aria-label={`Reduce ${item.name}`} onClick={() => changeQuantity(item.id, -1)}>−</button>
                    <strong>{item.quantity}</strong>
                    <button type="button" aria-label={`Add ${item.name}`} onClick={() => changeQuantity(item.id, 1)}>+</button>
                  </div>
                  <span className="item-unit">{item.unit}{item.quantity === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
            <div className="estimate-block">
              <div><label htmlFor="edit-calories">Estimated calories</label><div className="calorie-input-wrap"><input id="edit-calories" type="number" min="0" value={editing.calories} onChange={(event) => setEditing({ ...editing, calories: Math.max(0, Number(event.target.value)), low: Math.round(Number(event.target.value) * 0.84), high: Math.round(Number(event.target.value) * 1.22) })} /><span>kcal</span></div></div>
            </div>
            <div className="sheet-actions log-edit-actions">
              <button className="delete-sheet-button" type="button" onClick={() => { setMeals((current) => current.filter((meal) => meal.id !== editing.id)); setEditing(null); }}>Delete</button>
              <button className="save-button" type="button" onClick={saveEdit}>Save changes</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
