export type MealItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  caloriesPerUnit: number;
};

export type Meal = {
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

export const STORAGE_KEY = "lagoon-calorie-counter-meals-v1";
export const SETTINGS_KEY = "lagoon-calorie-counter-settings-v1";

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function readMeals(): Meal[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed: unknown = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed as Meal[] : [];
  } catch {
    return [];
  }
}

export function readGoal() {
  try {
    const saved = window.localStorage.getItem(SETTINGS_KEY);
    if (!saved) return 1900;
    const settings = JSON.parse(saved) as { maintenance?: number; deficit?: number };
    const maintenance = Number(settings.maintenance);
    const deficit = Number(settings.deficit);
    return Number.isFinite(maintenance) && Number.isFinite(deficit)
      ? Math.max(maintenance - deficit, 500)
      : 1900;
  } catch {
    return 1900;
  }
}
