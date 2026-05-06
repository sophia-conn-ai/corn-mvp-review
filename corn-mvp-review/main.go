package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"go-backend-react-frontend/db"
	"go-backend-react-frontend/handlers"
)

//go:generate sh -c "cd frontend && npm install && npm run build"
//go:embed frontend/dist
var frontendFS embed.FS

func main() {
	ctx := context.Background()

	// Connect to Postgres when DB_USER or INSTANCE_CONNECTION_NAME is set.
	// Falls back to in-memory store when neither is present (local dev mode).
	if os.Getenv("DB_USER") != "" || os.Getenv("INSTANCE_CONNECTION_NAME") != "" {
		pool, err := db.Connect(ctx)
		if err != nil {
			log.Fatalf("DB connect: %v", err)
		}
		if err := db.Migrate(ctx, pool); err != nil {
			log.Fatalf("DB migrate: %v", err)
		}
		handlers.SetDB(pool)
		log.Println("Connected to Postgres")
	} else {
		log.Println("No DB configured — using in-memory store (dev mode)")
	}

	r := gin.Default()

	// API routes
	api := r.Group("/api")
	{
		api.POST("/candidates", handlers.CreateCandidate)
		api.GET("/candidates", handlers.ListCandidates)
		api.GET("/candidates/weeks", handlers.ListWeeks)
		api.PATCH("/candidates/:id/grade", handlers.UpdateGrade)
		api.PATCH("/candidates/:id/stage", handlers.UpdateStage)
		api.GET("/legacy", handlers.ListLegacy)
	}

	// Serve embedded frontend in production, or proxy to Vite in dev
	if os.Getenv("ENV") == "dev" {
		log.Println("Running in dev mode — frontend should be served by Vite on :3000")
	} else {
		distFS, err := fs.Sub(frontendFS, "frontend/dist")
		if err != nil {
			log.Fatal(err)
		}
		r.NoRoute(func(c *gin.Context) {
			c.FileFromFS(c.Request.URL.Path, http.FS(distFS))
		})
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	log.Printf("Server starting on port %s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
