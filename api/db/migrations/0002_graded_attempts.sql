ALTER TABLE "attempts" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "score_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "graded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "netlist_version" integer;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "feedback" jsonb;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_score_check" CHECK ("attempts"."score" is null or "attempts"."score" between 0 and 100);