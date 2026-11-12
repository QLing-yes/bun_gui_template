CREATE TABLE `post` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text(255) NOT NULL,
	`content` text,
	`published` integer DEFAULT false NOT NULL,
	`author_id` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `role_permission` (
	`role_id` integer NOT NULL,
	`perm_code` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `role_permission_pk` PRIMARY KEY(`role_id`, `perm_code`),
	CONSTRAINT `fk_role_permission_role_id_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `role` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`code` text(64) NOT NULL UNIQUE,
	`name` text(64) NOT NULL,
	`description` text(255),
	`level` integer DEFAULT 0 NOT NULL,
	`is_system` integer DEFAULT false NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`status` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL UNIQUE,
	`user_agent` text,
	`ip` text(64),
	`expires_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_role` (
	`user_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `user_role_pk` PRIMARY KEY(`user_id`, `role_id`),
	CONSTRAINT `fk_user_role_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_user_role_role_id_role_id_fk` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`username` text(64) NOT NULL,
	`email` text(255),
	`phone` text(32),
	`password_hash` text NOT NULL,
	`nickname` text(64),
	`avatar` text(512),
	`status` integer DEFAULT 1 NOT NULL,
	`last_login_at` integer,
	`password_changed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `role_permission_code_idx` ON `role_permission` (`perm_code`);--> statement-breakpoint
CREATE INDEX `role_level_idx` ON `role` (`level`);--> statement-breakpoint
CREATE INDEX `role_status_idx` ON `role` (`status`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expires_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `user_role_role_idx` ON `user_role` (`role_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_uq` ON `user` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_uq` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_phone_uq` ON `user` (`phone`);--> statement-breakpoint
CREATE INDEX `user_status_idx` ON `user` (`status`);