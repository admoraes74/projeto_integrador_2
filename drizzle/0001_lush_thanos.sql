CREATE TABLE `portfolio_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`title` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`specialty` varchar(80) NOT NULL,
	`imageKey` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolio_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `provider_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`companyName` varchar(120) NOT NULL,
	`professionalName` varchar(120) NOT NULL,
	`phone` varchar(24) NOT NULL,
	`whatsapp` varchar(24) NOT NULL,
	`specialties` text NOT NULL,
	`description` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_profiles_userId_unique` UNIQUE(`userId`)
);
