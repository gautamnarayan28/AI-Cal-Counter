"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import FloatingNav from "../components/FloatingNav";
import type { Meal } from "../lib/calorie-data";
import { localDateKey, readGoal, readMeals } from "../lib/calorie-data";

export default function ProgressPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [goal, setGoal] = useState(1900);

  useEffect(() => {
    setMeals(readMeals());
    setGoal(readGoal());
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    const total = meals.filter((meal) => meal.dateKey === key).reduce((sum, meal) => sum + meal.calories, 0);
    return {
      key,
      total,
      label: new Intl.DateTimeFormat("en-IN", { weekday: "narrow" }).format(date),
      date: new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date),
      today: index === 6,
    };
  }), [meals]);

  const loggedDays = days.filter((day) => day.total > 0);
  const average = loggedDays.length ? Math.round(loggedDays.reduce((sum, day) => sum + day.total, 0) / loggedDays.length) : 0;

  return (
    <main className="app-shell page-shell">
      <section className="progress-section page-section" aria-labelledby="progress-heading">
        <div className="page-topline"><p className="section-label">LAST 7 DAYS</p><span>Target {goal.toLocaleString()}</span></div>
        <div className="feature-heading">
          <h1 id="progress-heading">Your rhythm,<br />not perfection.</h1>
          <span>Each bar is your real logged intake against your daily target.</span>
        </div>

        <div className="progress-summary">
          <div><span>Daily average</span><strong>{average ? average.toLocaleString() : "—"}</strong><small>kcal</small></div>
          <div><span>Days logged</span><strong>{loggedDays.length}</strong><small>of 7</small></div>
        </div>

        <div className="week-preview real-week" aria-label="Calories logged over the last seven days">
          {days.map((day) => {
            const percentage = day.total ? Math.min(Math.round((day.total / goal) * 100), 125) : 0;
            return (
              <div className={day.today ? "current" : ""} key={day.key}>
                <span className="bar-value">{day.total || ""}</span>
                <div className="bar-track"><span style={{ "--bar-height": `${percentage}%` } as CSSProperties} /></div>
                <small>{day.label}</small>
              </div>
            );
          })}
        </div>
        <p className="preview-caption">Empty days stay empty—this screen never invents data.</p>

        <div className="target-legend">
          <span><i className="legend-water" /> Logged intake</span>
          <span><i className="legend-line" /> {goal.toLocaleString()} kcal target</span>
        </div>
      </section>
      <FloatingNav active="progress" />
    </main>
  );
}
