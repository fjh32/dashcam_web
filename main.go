package main

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const (
	recordingsPath = "/var/lib/dashcam/recordings"
	webStaticDir   = "/var/lib/dashcam/static"
	pipePath       = "/tmp/camrecorder.pipe"
	port           = 80
)

func main() {
	http.Handle("/", http.FileServer(http.Dir(webStaticDir)))

	http.HandleFunc("/livestream.m3u8", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, filepath.Join(recordingsPath, "livestream.m3u8"))
	})

	http.HandleFunc("/segment", func(w http.ResponseWriter, r *http.Request) {
		segment := strings.TrimPrefix(r.URL.Path, "/segment")
		w.Header().Set("Content-Type", "video/mp2t")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, filepath.Join(recordingsPath, "segment"+segment))
	})

	http.HandleFunc("/output", func(w http.ResponseWriter, r *http.Request) {
		segment := strings.TrimPrefix(r.URL.Path, "/")
		// segment := r.URL.Path
		w.Header().Set("Content-Type", "video/mp2t")
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, filepath.Join(recordingsPath, segment))
	})

	http.HandleFunc("/recordings/", func(w http.ResponseWriter, r *http.Request) {
		filename := strings.TrimPrefix(r.URL.Path, "/recordings/")
		if strings.HasSuffix(filename, ".m3u8") {
			w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
		} else if strings.HasSuffix(filename, ".ts") {
			w.Header().Set("Content-Type", "video/mp2t")
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		http.ServeFile(w, r, filepath.Join(recordingsPath, filename))
	})

	http.HandleFunc("/recording_list", func(w http.ResponseWriter, r *http.Request) {
		entries := []string{}
		fs.WalkDir(os.DirFS(recordingsPath), ".", func(path string, d fs.DirEntry, err error) error {
			if !d.IsDir() && strings.HasSuffix(path, ".m3u8") && strings.Contains(path, "output") {
				entries = append(entries, path)
			}
			return nil
		})

		sort.Slice(entries, func(i, j int) bool {
			iInfo, _ := os.Stat(filepath.Join(recordingsPath, entries[i]))
			jInfo, _ := os.Stat(filepath.Join(recordingsPath, entries[j]))
			return iInfo.ModTime().After(jInfo.ModTime())
		})

		json.NewEncoder(w).Encode(entries)
	})

	http.HandleFunc("/service_status", func(w http.ResponseWriter, r *http.Request) {
		cmd := exec.Command("systemctl", "show", "-p", "ActiveState", "--value", "dashcam.service")
		output, err := cmd.Output()
		status := "unknown"
		if err == nil {
			status = strings.TrimSpace(string(output))
		} else {
			log.Printf("Error checking service status: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": status})
	})

	http.HandleFunc("/shutdown_cam_service", func(w http.ResponseWriter, r *http.Request) {
		log.Println("HTTP REQUEST ON /shutdown_cam_service. Sending kill message to CamService pipe in 1 second.")
		time.Sleep(1 * time.Second)
		pipeFile, err := os.OpenFile(pipePath, os.O_WRONLY|os.O_APPEND, 0600)
		if err == nil {
			defer pipeFile.Close()
			pipeFile.WriteString("kill\n")
		}
	})

	http.HandleFunc("/restart_cam_service", func(w http.ResponseWriter, r *http.Request) {
		log.Println("Restart request received for dashcam.service")

		cmd := exec.Command("systemctl", "restart", "dashcam.service")
		err := cmd.Run()

		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			log.Printf("Failed to restart dashcam.service: %v", err)
			http.Error(w, `{"status":"error","message":"Failed to restart service"}`, http.StatusInternalServerError)
			return
		}

		w.Write([]byte(`{"status":"ok","message":"Service restarted"}`))
	})

	http.HandleFunc("/save_recording", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		uptimeSec := int(time.Now().Unix()) // Replace with actual uptime() if needed
		msg := fmt.Sprintf("save:%d\n", uptimeSec)
		log.Println("Saving recording:", msg)
		pipeFile, err := os.OpenFile(pipePath, os.O_WRONLY|os.O_APPEND, 0600)
		if err == nil {
			defer pipeFile.Close()
			pipeFile.WriteString(msg)
		}
		http.Redirect(w, r, "/", http.StatusSeeOther)
	})

	log.Printf("Serving on :%d...\n", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
}
