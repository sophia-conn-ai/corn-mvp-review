package db

import (
	"context"
	"fmt"
	"net"
	"os"
	"strings"

	"cloud.google.com/go/cloudsqlconn"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect returns a pgxpool.Pool connected to Postgres.
// If INSTANCE_CONNECTION_NAME is set, uses the Cloud SQL connector (production).
// Otherwise connects to localhost:5432 (local dev with tunnel or local Postgres).
func Connect(ctx context.Context) (*pgxpool.Pool, error) {
	dbUser := os.Getenv("DB_USER")
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "postgres"
	}

	// Derive schema from service name (hyphens → underscores), default to app name.
	schema := strings.ReplaceAll(os.Getenv("K_SERVICE"), "-", "_")
	if schema == "" {
		schema = "corn_mvp_review"
	}

	// afterConnect sets search_path on every new connection in the pool.
	// The schema is pre-created by the platform; we only need to set the search path.
	afterConnect := func(ctx context.Context, conn *pgx.Conn) error {
		_, err := conn.Exec(ctx, "SET search_path TO "+schema)
		return err
	}

	instanceConn := os.Getenv("INSTANCE_CONNECTION_NAME")

	if instanceConn == "" {
		// Local: connect to localhost (tunnel handles auth).
		dsn := fmt.Sprintf("host=localhost port=5432 user=%s dbname=%s sslmode=disable", dbUser, dbName)
		config, err := pgxpool.ParseConfig(dsn)
		if err != nil {
			return nil, fmt.Errorf("parse config: %w", err)
		}
		config.AfterConnect = afterConnect
		return pgxpool.NewWithConfig(ctx, config)
	}

	// Production: Cloud SQL connector with IAM auth + private IP.
	dialer, err := cloudsqlconn.NewDialer(ctx,
		cloudsqlconn.WithIAMAuthN(),
		cloudsqlconn.WithDefaultDialOptions(cloudsqlconn.WithPrivateIP()),
	)
	if err != nil {
		return nil, fmt.Errorf("cloudsqlconn dialer: %w", err)
	}

	config, err := pgxpool.ParseConfig(fmt.Sprintf("user=%s dbname=%s sslmode=disable", dbUser, dbName))
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	config.ConnConfig.DialFunc = func(ctx context.Context, _, _ string) (net.Conn, error) {
		return dialer.Dial(ctx, instanceConn)
	}
	config.AfterConnect = afterConnect

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("pgxpool connect: %w", err)
	}
	return pool, nil
}
