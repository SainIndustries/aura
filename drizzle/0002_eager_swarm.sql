CREATE TYPE "public"."deployment_preference" AS ENUM('cloud', 'local', 'undecided');--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"use_case" text NOT NULL,
	"city" text NOT NULL,
	"deployment_preference" "deployment_preference" DEFAULT 'undecided' NOT NULL,
	"company" text,
	"notes" text,
	"contacted" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
