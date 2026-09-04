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

export type CalorieSettings = {
  maintenance: number;
  deficit: number;
};

export type CloudData = {
  meals: Meal[];
  settings: CalorieSettings | null;
};

export const STORAGE_KEY = "lagoon-calorie-counter-meals-v1";
export const SETTINGS_KEY = "lagoon-calorie-counter-settings-v1";
const MIGRATION_KEY = "lagoon-cloud-migration-v1";

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localMeals(): Meal[] {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed as Meal[] : [];
}

function localSettings(): CalorieSettings | null {
  const saved = window.localStorage.getItem(SETTINGS_KEY);
  if (!saved) return null;
  const parsed = JSON.parse(saved) as Partial<CalorieSettings>;
  const maintenance = Number(parsed.maintenance);
  const deficit = Number(parsed.deficit);
  return Number.isFinite(maintenance) && Number.isFinite(deficit)
    ? { maintenance, deficit }
    : null;
}

async function requestData(options?: RequestInit): Promise<CloudData> {
  const response = await fetch("/api/data", {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const result = await response.json() as CloudData & { error?: string };
  if (!response.ok) throw new Error(result.error || "Your saved data could not be reached.");
  return result;
}

export async function loadCloudData(): Promise<CloudData> {
  const cloud = await requestData();
  if (typeof window === "undefined" || window.localStorage.getItem(MIGRATION_KEY)) return cloud;

  let meals: Meal[] = [];
  let settings: CalorieSettings | null = null;
  try {
    meals = localMeals();
    settings = localSettings();
  } catch {
    window.localStorage.setItem(MIGRATION_KEY, "skipped");
    return cloud;
  }

  const importableMeals = cloud.meals.length === 0 ? meals : [];
  const importableSettings = cloud.settings ? null : settings;
  if (!importableMeals.length && !importableSettings) {
    window.localStorage.setItem(MIGRATION_KEY, "complete");
    return cloud;
  }

  const migrated = await saveCloudData({
    ...(importableMeals.length ? { meals: importableMeals } : {}),
    ...(importableSettings ? { settings: importableSettings } : {}),
  });
  window.localStorage.setItem(MIGRATION_KEY, "complete");
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(SETTINGS_KEY);
  return migrated;
}

export async function saveCloudData(update: Partial<CloudData>): Promise<CloudData> {
  return requestData({ method: "PUT", body: JSON.stringify(update) });
}

export function goalFromSettings(settings: CalorieSettings | null) {
  if (!settings) return 1900;
  return Math.max(settings.maintenance - settings.deficit, 500);
}
