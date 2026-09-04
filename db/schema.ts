import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const meals = sqliteTable("meals", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  dateKey: text("date_key").notNull(),
  time: text("time").notNull(),
  name: text("name").notNull(),
  note: text("note").notNull().default(""),
  calories: integer("calories").notNull(),
  low: integer("low").notNull(),
  high: integer("high").notNull(),
  confidence: text("confidence", { enum: ["High", "Medium"] }).notNull(),
  assumption: text("assumption").notNull().default(""),
  itemsJson: text("items_json").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const calorieSettings = sqliteTable("calorie_settings", {
  userEmail: text("user_email").primaryKey(),
  maintenance: integer("maintenance").notNull(),
  deficit: integer("deficit").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
