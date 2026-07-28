package services

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"golang.org/x/oauth2"
)

var webTokenStore struct {
	sync.RWMutex
	token *oauth2.Token
}

func SetWebOAuthToken(token *oauth2.Token) {
	webTokenStore.Lock()
	webTokenStore.token = token
	webTokenStore.Unlock()
}

func ClearWebOAuthToken() {
	SetWebOAuthToken(nil)
}

func HasWebOAuthToken() bool {
	webTokenStore.RLock()
	defer webTokenStore.RUnlock()
	return webTokenStore.token != nil && webTokenStore.token.AccessToken != ""
}

func WebTokenProvider(ctx context.Context) (string, error) {
	webTokenStore.RLock()
	token := webTokenStore.token
	webTokenStore.RUnlock()
	if token == nil || token.AccessToken == "" {
		return "", errors.New("web session is not authenticated")
	}
	if !token.Valid() {
		if token.RefreshToken == "" {
			return "", errors.New("oauth access token expired")
		}
		config, err := resolveOAuthConfig()
		if err != nil {
			return "", fmt.Errorf("load oauth config for refresh: %w", err)
		}
		refreshed, err := config.TokenSource(ctx, token).Token()
		if err != nil {
			return "", fmt.Errorf("refresh oauth token: %w", err)
		}
		SetWebOAuthToken(refreshed)
		token = refreshed
	}
	return token.AccessToken, nil
}