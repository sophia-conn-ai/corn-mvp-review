package greenhouse

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

type applicationResponse struct {
	CurrentStage struct {
		Name string `json:"name"`
	} `json:"current_stage"`
}

// FetchStage returns the current Greenhouse stage name for the candidate
// identified by the given greenhouseLink. Returns ("", nil) if the API key is
// empty or if the link contains no application_id query parameter.
func FetchStage(apiKey, greenhouseLink string) (string, error) {
	if apiKey == "" {
		return "", nil
	}

	u, err := url.Parse(greenhouseLink)
	if err != nil {
		return "", nil
	}
	applicationID := u.Query().Get("application_id")
	if applicationID == "" {
		return "", nil
	}

	endpoint := fmt.Sprintf("https://harvest.greenhouse.io/v1/applications/%s", applicationID)
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return "", fmt.Errorf("build request: %w", err)
	}
	req.SetBasicAuth(apiKey, "")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("greenhouse api: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("greenhouse api status %d", resp.StatusCode)
	}

	var body applicationResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	return body.CurrentStage.Name, nil
}
