import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    index,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
    'users',
    {
        id: uuid('id').defaultRandom().primaryKey(),

        email: varchar('email', { length: 255 }).notNull().unique(),

        password: text('password').notNull(),

        twoFactorEnabled: boolean('two_factor_enabled')
            .default(false)
            .notNull(),

        twoFactorSecret: text('two_factor_secret'),

        lastLoginAt: timestamp('last_login_at', { mode: 'date' }),

        passwordChangedAt: timestamp('password_changed_at', { mode: 'date' }),

        verifiedAt: timestamp('verified_at', { mode: 'date' }),

        createdAt: timestamp('created_at', { mode: 'date' })
            .defaultNow()
            .notNull(),

        updatedAt: timestamp('updated_at', { mode: 'date' })
            .defaultNow()
            .notNull(),

        deletedAt: timestamp('deleted_at', { mode: 'date' }),
    },
    (t) => [index('users_email_idx').on(t.email)],
);
