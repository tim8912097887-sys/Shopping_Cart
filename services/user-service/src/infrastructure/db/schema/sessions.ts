import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

import { auth } from "./auth.js";

export const sessions = pgTable(
    "sessions",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        userId: uuid("user_id")
            .notNull()
            .references(() => auth.id, {
                onDelete: "cascade",
            }),

        // refresh-token family
        tokenFamily: uuid("token_family").notNull(),

        // bcrypt(refreshToken)
        refreshTokenHash: text("refresh_token_hash").notNull(),

        userAgent: text("user_agent"),

        ip: text("ip"),

        lastUsedAt: timestamp("last_used_at", {
            mode: "date",
        })
            .defaultNow()
            .notNull(),

        expiresAt: timestamp("expires_at", {
            mode: "date",
        }).notNull(),

        revokedAt: timestamp("revoked_at", {
            mode: "date",
        }),

        compromisedAt: timestamp("compromised_at", {
            mode: "date",
        }),

        createdAt: timestamp("created_at", {
            mode: "date",
        })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp("updated_at", {
            mode: "date",
        })
            .defaultNow()
            .notNull(),
    },
    (t) => [
        index("sessions_user_id_idx").on(t.userId),

        index("sessions_token_family_idx").on(t.tokenFamily),

        index("sessions_expires_at_idx").on(t.expiresAt),

        index("sessions_revoked_at_idx").on(t.revokedAt),
    ],
);
