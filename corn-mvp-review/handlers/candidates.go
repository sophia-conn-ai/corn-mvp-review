package handlers

import (
	"crypto/rand"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
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

var (
	candidates []Candidate
	mu         sync.RWMutex
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

func CreateCandidate(c *gin.Context) {
	var req CreateCandidateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	now := time.Now()
	candidate := Candidate{
		ID:             generateID(),
		Name:           req.Name,
		Role:           req.Role,
		RecruiterName:  req.RecruiterName,
		GreenhouseLink: req.GreenhouseLink,
		Grades:         []UserGrade{},
		SubmittedAt:    now,
		WeekOf:         weekOf(now),
	}

	mu.Lock()
	candidates = append(candidates, candidate)
	mu.Unlock()

	c.JSON(http.StatusCreated, candidate)
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

	mu.Lock()
	defer mu.Unlock()
	for i, cand := range candidates {
		if cand.ID == id {
			// Upsert: update if user already graded, otherwise append
			for j, ug := range candidates[i].Grades {
				if ug.UserName == req.UserName {
					candidates[i].Grades[j].Grade = req.Grade
					c.JSON(http.StatusOK, candidates[i])
					return
				}
			}
			candidates[i].Grades = append(candidates[i].Grades, UserGrade{
				UserName: req.UserName,
				Grade:    req.Grade,
			})
			c.JSON(http.StatusOK, candidates[i])
			return
		}
	}
	c.JSON(http.StatusNotFound, gin.H{"error": "candidate not found"})
}

func ListCandidates(c *gin.Context) {
	week := c.Query("week")

	mu.RLock()
	defer mu.RUnlock()

	result := make([]Candidate, 0, len(candidates))
	for _, cand := range candidates {
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
	mu.RLock()
	defer mu.RUnlock()

	seen := map[string]bool{}
	weeks := make([]string, 0)
	for _, cand := range candidates {
		if !seen[cand.WeekOf] {
			seen[cand.WeekOf] = true
			weeks = append(weeks, cand.WeekOf)
		}
	}

	sort.Sort(sort.Reverse(sort.StringSlice(weeks)))
	c.JSON(http.StatusOK, weeks)
}
