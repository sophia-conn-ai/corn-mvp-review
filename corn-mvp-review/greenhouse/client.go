package greenhouse

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type ApplicationInfo struct {
	Stage     string
	Hired     bool
	AppliedAt time.Time
}

type applicationResponse struct {
	Status    string    `json:"status"` // "active", "rejected", "hired"
	AppliedAt time.Time `json:"applied_at"`
	CurrentStage struct {
		Name string `json:"name"`
	} `json:"current_stage"`
}

// FetchApplicationInfo returns the current stage, hired status, and original
// applied_at date for the candidate identified by the given greenhouseLink.
//
// Supported URL formats:
//   - https://app.greenhouse.io/people/{person_id}?application_id={app_id}
//   - https://app.greenhouse.io/people/{person_id}/applications/{app_id}/...
//   - https://app.greenhouse.io/people/{person_id}   (fetches most recent application)
//
// Returns zero-value ApplicationInfo (no error) when the API key is empty or
// the link cannot be parsed into a recognizable format.
func FetchApplicationInfo(apiKey, greenhouseLink string) (ApplicationInfo, error) {
	if apiKey == "" {
		return ApplicationInfo{}, nil
	}

	u, err := url.Parse(greenhouseLink)
	if err != nil {
		return ApplicationInfo{}, nil
	}

	// Prefer explicit application_id query param.
	if applicationID := u.Query().Get("application_id"); applicationID != "" {
		return fetchByApplicationID(apiKey, applicationID)
	}

	// Check for application ID in path: /people/{person_id}/applications/{app_id}/...
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	for i, p := range parts {
		if p == "applications" && i+1 < len(parts) && parts[i+1] != "" {
			return fetchByApplicationID(apiKey, parts[i+1])
		}
	}

	// Fall back to person ID from /people/{id} path.
	if len(parts) >= 2 && parts[0] == "people" && parts[1] != "" {
		return fetchMostRecentApplication(apiKey, parts[1])
	}

	return ApplicationInfo{}, nil
}

func fetchByApplicationID(apiKey, applicationID string) (ApplicationInfo, error) {
	endpoint := fmt.Sprintf("https://harvest.greenhouse.io/v1/applications/%s", applicationID)
	return doFetchOne(apiKey, endpoint)
}

func fetchMostRecentApplication(apiKey, personID string) (ApplicationInfo, error) {
	endpoint := fmt.Sprintf("https://harvest.greenhouse.io/v1/candidates/%s/applications", personID)

	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return ApplicationInfo{}, fmt.Errorf("build request: %w", err)
	}
	req.SetBasicAuth(apiKey, "")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ApplicationInfo{}, fmt.Errorf("greenhouse api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ApplicationInfo{}, fmt.Errorf("greenhouse api status %d", resp.StatusCode)
	}

	var apps []applicationResponse
	if err := json.NewDecoder(resp.Body).Decode(&apps); err != nil {
		return ApplicationInfo{}, fmt.Errorf("decode response: %w", err)
	}
	if len(apps) == 0 {
		return ApplicationInfo{}, nil
	}

	first := apps[0]
	return ApplicationInfo{
		Stage:     first.CurrentStage.Name,
		Hired:     strings.EqualFold(first.Status, "hired"),
		AppliedAt: first.AppliedAt,
	}, nil
}

func doFetchOne(apiKey, endpoint string) (ApplicationInfo, error) {
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return ApplicationInfo{}, fmt.Errorf("build request: %w", err)
	}
	req.SetBasicAuth(apiKey, "")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ApplicationInfo{}, fmt.Errorf("greenhouse api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return ApplicationInfo{}, fmt.Errorf("greenhouse api status %d", resp.StatusCode)
	}

	var body applicationResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return ApplicationInfo{}, fmt.Errorf("decode response: %w", err)
	}

	return ApplicationInfo{
		Stage:     body.CurrentStage.Name,
		Hired:     strings.EqualFold(body.Status, "hired"),
		AppliedAt: body.AppliedAt,
	}, nil
}
