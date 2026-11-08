ALTER TABLE `provider_profiles` MODIFY COLUMN `userId` int;--> statement-breakpoint
ALTER TABLE `provider_profiles` ADD `guestTokenHash` varchar(64);--> statement-breakpoint
ALTER TABLE `provider_profiles` ADD CONSTRAINT `provider_profiles_guestTokenHash_unique` UNIQUE(`guestTokenHash`);