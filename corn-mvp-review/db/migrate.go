package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Migrate creates the required tables if they don't exist.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS candidates (
			id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name               TEXT NOT NULL,
			role               TEXT NOT NULL,
			recruiter_name     TEXT NOT NULL,
			greenhouse_link    TEXT NOT NULL,
			stage              TEXT NOT NULL DEFAULT '',
			stage_updated_at   TIMESTAMPTZ,
			process_start_date TIMESTAMPTZ,
			submitted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			week_of            TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS candidate_grades (
			candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
			user_name    TEXT NOT NULL,
			grade        TEXT NOT NULL,
			updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			PRIMARY KEY (candidate_id, user_name)
		);
	`)
	if err != nil {
		return fmt.Errorf("migrate: %w", err)
	}
	return nil
}
