CREATE TABLE `provider_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`profileId` int NOT NULL,
	`voterHash` varchar(64) NOT NULL,
	`stars` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `provider_ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_ratings_profile_voter_uq` UNIQUE(`profileId`,`voterHash`)
);
--> statement-breakpoint
ALTER TABLE `provider_ratings` ADD CONSTRAINT `provider_ratings_profileId_provider_profiles_id_fk` FOREIGN KEY (`profileId`) REFERENCES `provider_profiles`(`id`) ON DELETE cascade ON UPDATE no action;