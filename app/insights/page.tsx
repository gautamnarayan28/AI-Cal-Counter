"use client";

import { useEffect, useMemo, useState } from "react";
import FloatingNav from "../components/FloatingNav";
import type { Meal } from "../lib/calorie-data";
import { goalFromSettings, loadCloudData } from "../lib/calorie-data";

export default function InsightsPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [goal, setGoal] = useState(1900);

  useEffect(() => {
    void loadCloudData().then((data) => {
      setMeals(data.meals);
      setGoal(goalFromSettings(data.settings));
    });
  }, []);

  const stats = useMemo(() => {
    const totals = new Map<string, number>();
    meals.forEach((meal) => totals.set(meal.dateKey, (totals.get(meal.dateKey) || 0) + meal.calories));
    const dailyTotals = [...totals.values()];
    const average = dailyTotals.length ? Math.round(dailyTotals.reduce((sum, total) => sum + total, 0) / dailyTotals.length) : 0;
    const nearTarget = dailyTotals.filter((total) => Math.abs(total - goal) <= 250).length;
    const mediumConfidence = meals.filter((meal) => meal.confidence === "Medium").length;
    return { days: dailyTotals.length, average, nearTarget, mediumConfidence };
  }, [goal, meals]);

  const daysNeeded = Math.max(7 - stats.days, 0);

  return (
    <main className="app-shell page-shell dark-page">
      <section className="insights-section page-section" aria-labelledby="insights-heading">
        <div className="page-topline"><p className="section-label">YOUR SIGNALS</p><span>{stats.days} {stats.days === 1 ? "day" : "days"} of data</span></div>
        <div className="feature-heading">
          <h1 id="insights-heading">Useful signals.<br />No judgment.</h1>
          <span>Simple patterns from what you actually logged. No made-up health conclusions.</span>
        </div>

        <div className="insight-stat-grid">
          <article><span>AVERAGE INTAKE</span><strong>{stats.average ? stats.average.toLocaleString() : "—"}</strong><small>kcal per logged day</small></article>
          <article><span>NEAR TARGET</span><strong>{stats.nearTarget}</strong><small>days within ±250 kcal</small></article>
          <article><span>MEALS LOGGED</span><strong>{meals.length}</strong><small>across {stats.days} {stats.days === 1 ? "day" : "days"}</small></article>
          <article><span>CHECK PORTIONS</span><strong>{stats.mediumConfidence}</strong><small>medium-confidence meals</small></article>
        </div>

        <div className="insight-preview-card live-insight-card">
          <div className="insight-orb"><span>{daysNeeded || "✓"}</span><small>{daysNeeded ? "days" : "ready"}</small></div>
          <div>
            <p>{daysNeeded ? "FIRST DEEPER INSIGHT UNLOCKS AFTER" : "ENOUGH DATA FOR WEEKLY INSIGHTS"}</p>
            <h2>{daysNeeded ? `${daysNeeded} more logged ${daysNeeded === 1 ? "day" : "days"}` : "A full week is ready"}</h2>
            <span>{daysNeeded ? "Keep logging normally. A complete week makes patterns more trustworthy." : `Your current logged-day average is ${stats.average.toLocaleString()} kcal against a ${goal.toLocaleString()} kcal target.`}</span>
          </div>
        </div>
      </section>
      <FloatingNav active="insights" />
    </main>
  );
}
