import { getD1 } from "../../../db";

const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const MAX_MEALS = 1000;

type MealItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  caloriesPerUnit: number;
};

type MealPayload = {
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

type SettingsPayload = { maintenance: number; deficit: number };

let schemaPromise: Promise<void> | null = null;

function identity(request: Request) {
  const email = request.headers.get(USER_EMAIL_HEADER)?.trim().toLowerCase();
  if (email) return email;
  return process.env.NODE_ENV !== "production" ? "local-development" : null;
}

async function ensureSchema() {
  if (schemaPromise) return schemaPromise;
  const db = getD1();
  schemaPromise = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS meals (
      id TEXT PRIMARY KEY NOT NULL,
      user_email TEXT NOT NULL,
      date_key TEXT NOT NULL,
      time TEXT NOT NULL,
      name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      calories INTEGER NOT NULL,
      low INTEGER NOT NULL,
      high INTEGER NOT NULL,
      confidence TEXT NOT NULL,
      assumption TEXT NOT NULL DEFAULT '',
      items_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS meals_user_date_idx ON meals (user_email, date_key)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS calorie_settings (
      user_email TEXT PRIMARY KEY NOT NULL,
      maintenance INTEGER NOT NULL,
      deficit INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
  ]).then(() => undefined).catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

function safeNumber(value: unknown, minimum: number, maximum: number) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(Math.max(number, minimum), maximum) : minimum;
}

function cleanMeal(value: unknown): MealPayload | null {
  if (!value || typeof value !== "object") return null;
  const meal = value as Partial<MealPayload>;
  if (!meal.id || !meal.dateKey || !meal.name || !Array.isArray(meal.items)) return null;
  const items = meal.items.slice(0, 30).map((item, index) => ({
    id: String(item.id || `${meal.id}-${index}`).slice(0, 120),
    name: String(item.name || "Food item").slice(0, 100),
    quantity: Math.min(Math.max(Number(item.quantity) || 1, 0.25), 50),
    unit: String(item.unit || "serving").slice(0, 30),
    caloriesPerUnit: safeNumber(item.caloriesPerUnit, 0, 5000),
  }));
  return {
    id: String(meal.id).slice(0, 120),
    dateKey: /^\d{4}-\d{2}-\d{2}$/.test(String(meal.dateKey)) ? String(meal.dateKey) : "1970-01-01",
    time: String(meal.time || "00:00").slice(0, 20),
    name: String(meal.name).slice(0, 150),
    note: String(meal.note || "").slice(0, 180),
    calories: safeNumber(meal.calories, 0, 50000),
    low: safeNumber(meal.low, 0, 50000),
    high: safeNumber(meal.high, 0, 50000),
    confidence: meal.confidence === "High" ? "High" : "Medium",
    assumption: String(meal.assumption || "").slice(0, 500),
    items,
  };
}

function cleanSettings(value: unknown): SettingsPayload | null {
  if (!value || typeof value !== "object") return null;
  const settings = value as Partial<SettingsPayload>;
  return {
    maintenance: safeNumber(settings.maintenance, 500, 10000),
    deficit: safeNumber(settings.deficit, 0, 2000),
  };
}

async function readData(userEmail: string) {
  const db = getD1();
  const [mealResult, settingsResult] = await Promise.all([
    db.prepare("SELECT * FROM meals WHERE user_email = ? ORDER BY date_key DESC, time DESC, created_at DESC")
      .bind(userEmail).all(),
    db.prepare("SELECT maintenance, deficit FROM calorie_settings WHERE user_email = ?")
      .bind(userEmail).first<{ maintenance: number; deficit: number }>(),
  ]);

  const meals = mealResult.results.map((row) => ({
    id: String(row.id),
    dateKey: String(row.date_key),
    time: String(row.time),
    name: String(row.name),
    note: String(row.note),
    calories: Number(row.calories),
    low: Number(row.low),
    high: Number(row.high),
    confidence: row.confidence === "High" ? "High" as const : "Medium" as const,
    assumption: String(row.assumption),
    items: JSON.parse(String(row.items_json)) as MealItem[],
  }));
  return { meals, settings: settingsResult || null };
}

export async function GET(request: Request) {
  const userEmail = identity(request);
  if (!userEmail) return Response.json({ error: "Please sign in to open your saved meals." }, { status: 401 });
  try {
    await ensureSchema();
    return Response.json(await readData(userEmail));
  } catch {
    return Response.json({ error: "The meal database could not be opened." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userEmail = identity(request);
  if (!userEmail) return Response.json({ error: "Please sign in to save meals." }, { status: 401 });
  try {
    const payload = await request.json() as { meals?: unknown; settings?: unknown };
    if (payload.meals === undefined && payload.settings === undefined) {
      return Response.json({ error: "Nothing was provided to save." }, { status: 400 });
    }
    await ensureSchema();
    const db = getD1();
    const now = Date.now();
    const statements = [];

    if (payload.meals !== undefined) {
      if (!Array.isArray(payload.meals) || payload.meals.length > MAX_MEALS) {
        return Response.json({ error: "The meal list is too large or invalid." }, { status: 400 });
      }
      const meals = payload.meals.map(cleanMeal);
      if (meals.some((meal) => !meal)) {
        return Response.json({ error: "One of the meals could not be saved." }, { status: 400 });
      }
      statements.push(db.prepare("DELETE FROM meals WHERE user_email = ?").bind(userEmail));
      for (const meal of meals as MealPayload[]) {
        statements.push(db.prepare(`INSERT INTO meals (
          id, user_email, date_key, time, name, note, calories, low, high,
          confidence, assumption, items_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(meal.id, userEmail, meal.dateKey, meal.time, meal.name, meal.note,
            meal.calories, meal.low, meal.high, meal.confidence, meal.assumption,
            JSON.stringify(meal.items), now, now));
      }
    }

    if (payload.settings !== undefined) {
      const settings = cleanSettings(payload.settings);
      if (!settings) return Response.json({ error: "The calorie settings are invalid." }, { status: 400 });
      statements.push(db.prepare(`INSERT INTO calorie_settings (user_email, maintenance, deficit, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_email) DO UPDATE SET
          maintenance = excluded.maintenance,
          deficit = excluded.deficit,
          updated_at = excluded.updated_at`)
        .bind(userEmail, settings.maintenance, settings.deficit, now));
    }

    await db.batch(statements);
    return Response.json(await readData(userEmail));
  } catch {
    return Response.json({ error: "Your changes could not be saved to the cloud." }, { status: 500 });
  }
}
