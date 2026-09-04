CREATE TABLE `calorie_settings` (
	`user_email` text PRIMARY KEY NOT NULL,
	`maintenance` integer NOT NULL,
	`deficit` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_email` text NOT NULL,
	`date_key` text NOT NULL,
	`time` text NOT NULL,
	`name` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`calories` integer NOT NULL,
	`low` integer NOT NULL,
	`high` integer NOT NULL,
	`confidence` text NOT NULL,
	`assumption` text DEFAULT '' NOT NULL,
	`items_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
