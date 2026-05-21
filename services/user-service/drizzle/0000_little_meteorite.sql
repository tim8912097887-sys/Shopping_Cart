CREATE TABLE "auth" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"fail_login_attempts" integer DEFAULT 0 NOT NULL,
	"login_lock_until" timestamp,
	"two_factor_secret" text,
	"last_login_at" timestamp,
	"password_changed_at" timestamp,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "auth_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_family" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"last_used_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"compromised_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_auth_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "auth" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_family_idx" ON "sessions" USING btree ("token_family");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "sessions_revoked_at_idx" ON "sessions" USING btree ("revoked_at");