package handlers

import (
	"context"
	"crypto/rand"
	"fmt"
	"net/http"
	"os"
	"sort"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"go-backend-react-frontend/greenhouse"
)

type Grade string

const (
	GradeDefinitelyNot Grade = "Definitely Not"
	GradeNo            Grade = "No"
	GradeYes           Grade = "Yes"
	GradeStrongYes     Grade = "Strong Yes"
)

var validGrades = map[Grade]bool{
	GradeDefinitelyNot: true,
	GradeNo:            true,
	GradeYes:           true,
	GradeStrongYes:     true,
}

type UserGrade struct {
	UserName string `json:"user_name"`
	Grade    Grade  `json:"grade"`
}

type Candidate struct {
	ID             string      `json:"id"`
	Name           string      `json:"name"`
	Role           string      `json:"role"`
	RecruiterName  string      `json:"recruiter_name"`
	GreenhouseLink string      `json:"greenhouse_link"`
	Stage          string      `json:"stage"`
	Grades         []UserGrade `json:"grades"`
	SubmittedAt    time.Time   `json:"submitted_at"`
	WeekOf         string      `json:"week_of"`
}

type CreateCandidateRequest struct {
	Name           string `json:"name" binding:"required"`
	Role           string `json:"role" binding:"required"`
	RecruiterName  string `json:"recruiter_name" binding:"required"`
	GreenhouseLink string `json:"greenhouse_link" binding:"required"`
}

type UpdateGradeRequest struct {
	UserName string `json:"user_name" binding:"required"`
	Grade    Grade  `json:"grade" binding:"required"`
}

type UpdateStageRequest struct {
	Stage string `json:"stage" binding:"required"`
}

// pool is the Postgres connection pool; nil means use in-memory store.
var pool *pgxpool.Pool

// SetDB wires up the Postgres pool. Called once from main before requests are served.
func SetDB(p *pgxpool.Pool) {
	pool = p
}

// ── In-memory fallback (used when pool == nil, i.e. local dev without DB) ─────

var (
	memCandidates []Candidate
	mu            sync.RWMutex
)

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}

func weekOf(t time.Time) string {
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	monday := t.AddDate(0, 0, -(weekday - 1))
	return monday.Format("2006-01-02")
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func CreateCandidate(c *gin.Context) {
	var req CreateCandidateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	wk := weekOf(now)

	if pool != nil {
		row := pool.QueryRow(c.Request.Context(), `
			INSERT INTO candidates (name, role, recruiter_name, greenhouse_link, week_of, submitted_at)
			VALUES ($1, $2, $3, $4, $5, $6)
			RETURNING id, name, role, recruiter_name, greenhouse_link, stage, submitted_at, week_of
		`, req.Name, req.Role, req.RecruiterName, req.GreenhouseLink, wk, now)

		var cand Candidate
		if err := row.Scan(&cand.ID, &cand.Name, &cand.Role, &cand.RecruiterName,
			&cand.GreenhouseLink, &cand.Stage, &cand.SubmittedAt, &cand.WeekOf); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		cand.Grades = []UserGrade{}
		// Kick off stage fetch in background immediately after submission
		go syncStage(cand.ID, cand.GreenhouseLink)
		c.JSON(http.StatusCreated, cand)
		return
	}

	// In-memory fallback
	cand := Candidate{
		ID:             generateID(),
		Name:           req.Name,
		Role:           req.Role,
		RecruiterName:  req.RecruiterName,
		GreenhouseLink: req.GreenhouseLink,
		Grades:         []UserGrade{},
		SubmittedAt:    now,
		WeekOf:         wk,
	}
	mu.Lock()
	memCandidates = append(memCandidates, cand)
	mu.Unlock()
	c.JSON(http.StatusCreated, cand)
}

func UpdateGrade(c *gin.Context) {
	id := c.Param("id")
	var req UpdateGradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !validGrades[req.Grade] {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid grade"})
		return
	}

	if pool != nil {
		ctx := c.Request.Context()
		_, err := pool.Exec(ctx, `
			INSERT INTO candidate_grades (candidate_id, user_name, grade, updated_at)
			VALUES ($1, $2, $3, NOW())
			ON CONFLICT (candidate_id, user_name) DO UPDATE
			  SET grade = EXCLUDED.grade, updated_at = NOW()
		`, id, req.UserName, string(req.Grade))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		cand, err := fetchByID(ctx, id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "candidate not found"})
			return
		}
		c.JSON(http.StatusOK, cand)
		return
	}

	// In-memory fallback
	mu.Lock()
	defer mu.Unlock()
	for i, cand := range memCandidates {
		if cand.ID == id {
			for j, ug := range memCandidates[i].Grades {
				if ug.UserName == req.UserName {
					memCandidates[i].Grades[j].Grade = req.Grade
					c.JSON(http.StatusOK, memCandidates[i])
					return
				}
			}
			memCandidates[i].Grades = append(memCandidates[i].Grades, UserGrade{
				UserName: req.UserName,
				Grade:    req.Grade,
			})
			c.JSON(http.StatusOK, memCandidates[i])
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "candidate not found"})
}

// UpdateStage lets callers manually set a candidate's stage (used until Greenhouse
// API key is configured, or to override the auto-synced value).
func UpdateStage(c *gin.Context) {
	id := c.Param("id")
	var req UpdateStageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if pool != nil {
		ctx := c.Request.Context()
		if _, err := pool.Exec(ctx, `
			UPDATE candidates SET stage = $1, stage_updated_at = NOW() WHERE id = $2
		`, req.Stage, id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		cand, err := fetchByID(ctx, id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "candidate not found"})
			return
		}
		c.JSON(http.StatusOK, cand)
		return
	}

	mu.Lock()
	defer mu.Unlock()
	for i, cand := range memCandidates {
		if cand.ID == id {
			memCandidates[i].Stage = req.Stage
			c.JSON(http.StatusOK, memCandidates[i])
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "candidate not found"})
}

func ListCandidates(c *gin.Context) {
	week := c.Query("week")

	if pool != nil {
		result, err := fetchCandidates(c.Request.Context(), week)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		// Async: refresh stages for any candidate that has no stage yet
		go func() {
			for _, cand := range result {
				if cand.Stage == "" {
					syncStage(cand.ID, cand.GreenhouseLink)
				}
			}
		}()
		c.JSON(http.StatusOK, result)
		return
	}

	// In-memory fallback
	mu.RLock()
	defer mu.RUnlock()
	result := make([]Candidate, 0, len(memCandidates))
	for _, cand := range memCandidates {
		if week == "" || cand.WeekOf == week {
			result = append(result, cand)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].SubmittedAt.After(result[j].SubmittedAt)
	})
	c.JSON(http.StatusOK, result)
}

func ListWeeks(c *gin.Context) {
	if pool != nil {
		rows, err := pool.Query(c.Request.Context(), `
			SELECT DISTINCT week_of FROM candidates ORDER BY week_of DESC
		`)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer rows.Close()
		weeks := make([]string, 0)
		for rows.Next() {
			var w string
			if err := rows.Scan(&w); err == nil {
				weeks = append(weeks, w)
			}
		}
		c.JSON(http.StatusOK, weeks)
		return
	}

	// In-memory fallback
	mu.RLock()
	defer mu.RUnlock()
	seen := map[string]bool{}
	weeks := make([]string, 0)
	for _, cand := range memCandidates {
		if !seen[cand.WeekOf] {
			seen[cand.WeekOf] = true
			weeks = append(weeks, cand.WeekOf)
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(weeks)))
	c.JSON(http.StatusOK, weeks)
}

// ── DB helpers ────────────────────────────────────────────────────────────────

func fetchCandidates(ctx context.Context, week string) ([]Candidate, error) {
	query := `
		SELECT c.id, c.name, c.role, c.recruiter_name, c.greenhouse_link,
		       c.stage, c.submitted_at, c.week_of,
		       g.user_name, g.grade
		FROM candidates c
		LEFT JOIN candidate_grades g ON g.candidate_id = c.id
	`
	args := []any{}
	if week != "" {
		query += " WHERE c.week_of = $1"
		args = append(args, week)
	}
	query += " ORDER BY c.submitted_at DESC, c.id"

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ordered := []string{}
	byID := map[string]*Candidate{}

	for rows.Next() {
		var (
			id, name, role, recruiterName, greenhouseLink, stage, weekOfStr string
			submittedAt                                                      time.Time
			userNameStr, gradeStr                                            *string
		)
		if err := rows.Scan(&id, &name, &role, &recruiterName, &greenhouseLink,
			&stage, &submittedAt, &weekOfStr, &userNameStr, &gradeStr); err != nil {
			return nil, err
		}
		if _, exists := byID[id]; !exists {
			byID[id] = &Candidate{
				ID:             id,
				Name:           name,
				Role:           role,
				RecruiterName:  recruiterName,
				GreenhouseLink: greenhouseLink,
				Stage:          stage,
				SubmittedAt:    submittedAt,
				WeekOf:         weekOfStr,
				Grades:         []UserGrade{},
			}
			ordered = append(ordered, id)
		}
		if userNameStr != nil && gradeStr != nil {
			byID[id].Grades = append(byID[id].Grades, UserGrade{
				UserName: *userNameStr,
				Grade:    Grade(*gradeStr),
			})
		}
	}

	result := make([]Candidate, 0, len(ordered))
	for _, id := range ordered {
		result = append(result, *byID[id])
	}
	return result, nil
}

func fetchByID(ctx context.Context, id string) (Candidate, error) {
	rows, err := pool.Query(ctx, `
		SELECT c.id, c.name, c.role, c.recruiter_name, c.greenhouse_link,
		       c.stage, c.submitted_at, c.week_of,
		       g.user_name, g.grade
		FROM candidates c
		LEFT JOIN candidate_grades g ON g.candidate_id = c.id
		WHERE c.id = $1
	`, id)
	if err != nil {
		return Candidate{}, err
	}
	defer rows.Close()

	var cand *Candidate
	for rows.Next() {
		var (
			cID, name, role, recruiterName, greenhouseLink, stage, weekOfStr string
			submittedAt                                                       time.Time
			userNameStr, gradeStr                                             *string
		)
		if err := rows.Scan(&cID, &name, &role, &recruiterName, &greenhouseLink,
			&stage, &submittedAt, &weekOfStr, &userNameStr, &gradeStr); err != nil {
			return Candidate{}, err
		}
		if cand == nil {
			cand = &Candidate{
				ID:             cID,
				Name:           name,
				Role:           role,
				RecruiterName:  recruiterName,
				GreenhouseLink: greenhouseLink,
				Stage:          stage,
				SubmittedAt:    submittedAt,
				WeekOf:         weekOfStr,
				Grades:         []UserGrade{},
			}
		}
		if userNameStr != nil && gradeStr != nil {
			cand.Grades = append(cand.Grades, UserGrade{
				UserName: *userNameStr,
				Grade:    Grade(*gradeStr),
			})
		}
	}
	if cand == nil {
		return Candidate{}, fmt.Errorf("not found")
	}
	return *cand, nil
}

// syncStage fetches the current Greenhouse stage for a candidate and updates the DB.
// No-op when GREENHOUSE_API_KEY is not set or the link has no application_id.
func syncStage(candidateID, greenhouseLink string) {
	apiKey := os.Getenv("GREENHOUSE_API_KEY")
	if apiKey == "" || pool == nil {
		return
	}
	stage, err := greenhouse.FetchStage(apiKey, greenhouseLink)
	if err != nil || stage == "" {
		return
	}
	pool.Exec(context.Background(), `
		UPDATE candidates SET stage = $1, stage_updated_at = NOW() WHERE id = $2
	`, stage, candidateID)
}
