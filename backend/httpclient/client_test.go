package httpclient

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDoJSONAcceptsCreatedBusinessCode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"code":201,"msg":"created","data":null}`))
	}))
	defer server.Close()

	client := New(Options{BaseURL: server.URL})
	if err := client.DoJSON(context.Background(), http.MethodPost, "/user/tunnel", nil, map[string]string{"remark": "demo"}, nil); err != nil {
		t.Fatalf("DoJSON() returned an error for business code 201: %v", err)
	}
}