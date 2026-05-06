package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Migrate creates the required tables if they don't exist.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS candidates (
			id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name             TEXT NOT NULL,
			role             TEXT NOT NULL,
			recruiter_name   TEXT NOT NULL,
			greenhouse_link  TEXT NOT NULL,
			stage            TEXT NOT NULL DEFAULT '',
			stage_updated_at TIMESTAMPTZ,
			submitted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			week_of          TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS candidate_grades (
			candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
			user_name    TEXT NOT NULL,
			grade        TEXT NOT NULL,
			updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (candidate_id, user_name)
		)`,
		`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS hired BOOLEAN NOT NULL DEFAULT FALSE`,
	}
	for _, s := range stmts {
		if _, err := pool.Exec(ctx, s); err != nil {
			return fmt.Errorf("migrate: %w", err)
		}
	}
	return nil
}
