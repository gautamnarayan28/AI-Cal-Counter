# Calorie Counter — Product Brief

## Purpose

A private, mobile-first food journal that makes approximate calorie tracking fast enough to use every day. The user can photograph a meal or describe it in ordinary language, review an AI-generated estimate, adjust it if necessary, and save it.

The product optimizes for consistency and low effort rather than medical-grade nutritional precision.

## First-version experience

1. Open directly on **Today**.
2. See calories consumed, daily target, and estimated calories remaining.
3. Add a meal using a photo or text description.
4. Review the estimated foods, portions, calorie total, range, confidence, and assumptions.
5. Correct the estimate if needed and save it.
6. Edit or delete any saved meal.
7. Review daily, weekly, and monthly totals.
8. Set maintenance calories and a preferred daily deficit in Settings.

## Main sections

- **Today:** daily progress and meal capture.
- **Insights:** daily, weekly, and monthly trends.
- **Settings:** maintenance calories, preferred deficit, units, and personal food defaults.

## Accuracy principles

- Every AI result is an estimate, not a fact.
- Display a likely range alongside the working calorie number.
- Explain assumptions when portion size or cooking method is unclear.
- Let the user edit every result before and after saving.
- Calculate totals in the app from saved records; do not ask the AI to remember or total meal history.

## Privacy principle

Initially, meal photos should be compressed, analyzed, and discarded. We will only store photographs later if a visual meal history is genuinely useful.

## Build stages

1. **Foundation and wireframe:** project setup and non-functional Today screen.
2. **Interactive local prototype:** add/edit/delete sample meals on one device.
3. **Storage:** save meals reliably in a database.
4. **AI text estimates:** connect typed meal descriptions to the model.
5. **Photo estimates:** add camera capture and image analysis.
6. **Insights:** daily, weekly, and monthly charts.
7. **Accounts and launch:** private sign-in, installable mobile app behavior, and deployment.

## Current scope

Stage 1 only. The visible screen is a wireframe with realistic content. Controls are intentionally not connected yet.
