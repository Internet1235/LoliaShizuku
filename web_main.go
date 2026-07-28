//go:build web

package main

import (
	"log"
	"os"

	"github.com/Mxmilu666/LoliaShizuku/backend"
	"github.com/Mxmilu666/LoliaShizuku/backend/services"
)

func main() {
	addr := os.Getenv("LOLIA_WEB_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	server, err := backend.NewWebServer(backend.WebServerOptions{
		Addr:          addr,
		StaticDir:     "frontend/dist",
		CenterService: services.NewCenterServiceWithTokenProvider(services.WebTokenProvider),
		FrpcService:   services.NewFrpcService(),
	})
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("LoliaShizuku web server listening on %s", addr)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}