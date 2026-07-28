package backend

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Mxmilu666/LoliaShizuku/backend/httpclient"
	"github.com/Mxmilu666/LoliaShizuku/backend/models"
	"github.com/Mxmilu666/LoliaShizuku/backend/services"
	"github.com/Mxmilu666/LoliaShizuku/backend/version"
	"golang.org/x/oauth2"
)

const webSessionCookie = "lolia_session"

type WebServerOptions struct {
	Addr          string
	StaticDir     string
	CenterService *services.CenterService
	FrpcService   *services.FrpcService
}

type WebServer struct {
	addr          string
	staticDir     string
	center        *services.CenterService
	frpc          *services.FrpcService
	sessionSecret string

	oauthMu       sync.Mutex
	oauthState    string
	oauthVerifier string
	oauthCreated  time.Time
}

func NewWebServer(options WebServerOptions) (*WebServer, error) {
	if options.CenterService == nil || options.FrpcService == nil {
		return nil, errors.New("web server services are required")
	}
	if options.StaticDir == "" {
		options.StaticDir = "frontend/dist"
	}
	sessionSecret, err := randomWebString(32)
	if err != nil {
		return nil, fmt.Errorf("create web session secret: %w", err)
	}
	return &WebServer{
		addr:          options.Addr,
		staticDir:     options.StaticDir,
		center:        options.CenterService,
		frpc:          options.FrpcService,
		sessionSecret: sessionSecret,
	}, nil
}

func (s *WebServer) ListenAndServe() error {
	if _, err := os.Stat(filepath.Join(s.staticDir, "index.html")); err != nil {
		return fmt.Errorf("frontend build not found at %s: %w", s.staticDir, err)
	}
	return http.ListenAndServe(s.addr, s.handler())
}

func (s *WebServer) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/status", s.authStatus)
	mux.HandleFunc("/api/auth/login", s.authLogin)
	mux.HandleFunc("/api/auth/callback", s.authCallback)
	mux.HandleFunc("/api/auth/logout", s.authLogout)
	mux.HandleFunc("/api/center/", s.centerHandler)
	mux.HandleFunc("/api/frpc/", s.frpcHandler)
	mux.HandleFunc("/api/version", s.versionHandler)

	static := http.FileServer(http.Dir(s.staticDir))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		relativePath := strings.TrimPrefix(filepath.Clean(r.URL.Path), string(filepath.Separator))
		if r.URL.Path != "/" && fileExists(filepath.Join(s.staticDir, relativePath)) {
			static.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, filepath.Join(s.staticDir, "index.html"))
	})
	return mux
}

func (s *WebServer) authStatus(w http.ResponseWriter, r *http.Request) {
	s.writeJSON(w, http.StatusOK, map[string]bool{"authenticated": s.authenticated(r)})
}

func (s *WebServer) authLogin(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	config, err := webOAuthConfig(r)
	if err != nil {
		s.writeError(w, err)
		return
	}
	state, err := randomWebString(32)
	if err != nil {
		s.writeError(w, err)
		return
	}
	verifier, err := randomWebString(64)
	if err != nil {
		s.writeError(w, err)
		return
	}
	s.oauthMu.Lock()
	s.oauthState, s.oauthVerifier, s.oauthCreated = state, verifier, time.Now()
	s.oauthMu.Unlock()

	authURL := config.AuthCodeURL(state, oauth2.AccessTypeOffline, oauth2.S256ChallengeOption(verifier))
	s.writeJSON(w, http.StatusOK, map[string]string{"url": authURL})
}

func (s *WebServer) authCallback(w http.ResponseWriter, r *http.Request) {
	s.oauthMu.Lock()
	state, verifier, created := s.oauthState, s.oauthVerifier, s.oauthCreated
	s.oauthMu.Unlock()
	requestState := r.URL.Query().Get("state")
	if state == "" || time.Since(created) > 5*time.Minute || subtle.ConstantTimeCompare([]byte(state), []byte(requestState)) != 1 {
		http.Error(w, "OAuth state mismatch", http.StatusBadRequest)
		return
	}
	if oauthError := strings.TrimSpace(r.URL.Query().Get("error")); oauthError != "" {
		http.Error(w, oauthError, http.StatusBadRequest)
		return
	}
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	if code == "" {
		http.Error(w, "missing OAuth code", http.StatusBadRequest)
		return
	}
	config, err := webOAuthConfig(r)
	if err != nil {
		s.writeError(w, err)
		return
	}
	token, err := config.Exchange(r.Context(), code, oauth2.VerifierOption(verifier))
	if err != nil {
		s.writeError(w, fmt.Errorf("exchange oauth code: %w", err))
		return
	}
	services.SetWebOAuthToken(token)
	s.oauthMu.Lock()
	s.oauthState, s.oauthVerifier = "", ""
	s.oauthMu.Unlock()
	http.SetCookie(w, &http.Cookie{
		Name:     webSessionCookie,
		Value:    s.sessionSecret,
		Path:     "/",
		HttpOnly: true,
		Secure:   requestScheme(r) == "https",
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, "/", http.StatusFound)
}

func (s *WebServer) authLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	_, _ = s.center.StopRunner()
	services.ClearWebOAuthToken()
	http.SetCookie(w, &http.Cookie{Name: webSessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	s.writeJSON(w, http.StatusOK, map[string]bool{"authenticated": false})
}

func (s *WebServer) centerHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireAuth(w, r) {
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/center/")
	var value any
	var err error
	switch path {
	case "dashboard":
		value, err = s.center.GetDashboard()
	case "nodes":
		value, err = s.center.GetNodes()
	case "tunnels":
		value, err = s.center.GetTunnelsOverview(queryInt(r, "page", 1), queryInt(r, "limit", 50), queryInt(r, "days", 2))
	case "tunnel/create":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var input models.CreateTunnelInput
		if err = json.NewDecoder(r.Body).Decode(&input); err == nil {
			value, err = s.center.CreateTunnel(input)
		}
	case "runner/data":
		value, err = s.center.GetRunnerData(int64(queryInt(r, "tunnel_id", 0)))
	case "runner/status":
		value, err = s.center.GetRunnerRuntimeStatus()
	case "traffic/daily":
		value, err = s.center.GetTrafficDaily(queryInt(r, "days", 7))
	case "tunnel/detail":
		if r.Method == http.MethodPut {
			var input models.UpdateTunnelInput
			if err = json.NewDecoder(r.Body).Decode(&input); err == nil {
				value, err = s.center.UpdateTunnel(r.URL.Query().Get("name"), input)
			}
		} else if r.Method == http.MethodGet {
			value, err = s.center.GetTunnelDetail(r.URL.Query().Get("name"))
		} else {
			methodNotAllowed(w)
			return
		}
	case "runner/start":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		var input struct {
			TunnelNames []string `json:"tunnel_names"`
		}
		if err = json.NewDecoder(r.Body).Decode(&input); err == nil {
			value, err = s.center.StartRunner(input.TunnelNames)
		}
	case "runner/stop":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		value, err = s.center.StopRunner()
	default:
		http.NotFound(w, r)
		return
	}
	if err != nil {
		s.writeError(w, err)
		return
	}
	s.writeJSON(w, http.StatusOK, value)
}

func (s *WebServer) frpcHandler(w http.ResponseWriter, r *http.Request) {
	if !s.requireAuth(w, r) {
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/api/frpc/")
	var value any
	var err error
	switch path {
	case "status":
		value, err = s.frpc.GetFrpcStatus()
	case "install":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		value, err = s.frpc.InstallOrUpdateFrpc()
	case "cancel":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		err = s.frpc.CancelInstallOrUpdateFrpc()
	case "remove":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		err = s.frpc.RemoveFrpc()
	case "mirror":
		if r.Method == http.MethodGet {
			value, err = s.frpc.GetMirrorConfig()
			break
		}
		if r.Method != http.MethodPut {
			methodNotAllowed(w)
			return
		}
		var config models.FrpcMirrorConfig
		err = json.NewDecoder(r.Body).Decode(&config)
		if err == nil {
			err = s.frpc.SetMirrorConfig(config)
		}
	default:
		http.NotFound(w, r)
		return
	}
	if err != nil {
		s.writeError(w, err)
		return
	}
	s.writeJSON(w, http.StatusOK, value)
}

func (s *WebServer) versionHandler(w http.ResponseWriter, _ *http.Request) {
	s.writeJSON(w, http.StatusOK, version.GetInfo())
}

func (s *WebServer) authenticated(r *http.Request) bool {
	cookie, err := r.Cookie(webSessionCookie)
	return err == nil && subtle.ConstantTimeCompare([]byte(cookie.Value), []byte(s.sessionSecret)) == 1 && services.HasWebOAuthToken()
}

func (s *WebServer) requireAuth(w http.ResponseWriter, r *http.Request) bool {
	if s.authenticated(r) {
		return true
	}
	s.writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "未登录"})
	return false
}

func (s *WebServer) writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func (s *WebServer) writeError(w http.ResponseWriter, err error) {
	status := http.StatusBadRequest
	message := err.Error()
	var apiErr *httpclient.APIError
	if errors.As(err, &apiErr) {
		if apiErr.StatusCode >= 400 && apiErr.StatusCode <= 599 {
			status = apiErr.StatusCode
		}
		if strings.TrimSpace(apiErr.Message) != "" {
			message = apiErr.Message
		}
	}
	s.writeJSON(w, status, map[string]string{"error": message})
}

func methodNotAllowed(w http.ResponseWriter) {
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func webOAuthConfig(r *http.Request) (*oauth2.Config, error) {
	config, err := services.ResolveWebOAuthConfig()
	if err != nil {
		return nil, err
	}
	config.RedirectURL = webRedirectURL(r)
	return config, nil
}

func webRedirectURL(r *http.Request) string {
	if publicURL := strings.TrimRight(strings.TrimSpace(os.Getenv("LOLIA_WEB_PUBLIC_URL")), "/"); publicURL != "" {
		return publicURL + "/api/auth/callback"
	}
	return (&url.URL{Scheme: requestScheme(r), Host: r.Host, Path: "/api/auth/callback"}).String()
}

func requestScheme(r *http.Request) string {
	if forwarded := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0]); forwarded == "http" || forwarded == "https" {
		return forwarded
	}
	if r.TLS != nil {
		return "https"
	}
	return "http"
}

func randomWebString(size int) (string, error) {
	data := make([]byte, size)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func queryInt(r *http.Request, key string, fallback int) int {
	value, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil {
		return fallback
	}
	return value
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}