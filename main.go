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
	"regexp"
	"sort"
	"strconv"
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

		log.Println("SHUTDOWN request received for dashcam.service")

		cmd := exec.Command("sudo", "/usr/bin/systemctl", "stop", "dashcam.service")
		err := cmd.Run()

		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			log.Printf("Failed to SHUTDOWN dashcam.service: %v", err)
			http.Error(w, `{"status":"error","message":"Failed to SHUTDOWN service"}`, http.StatusInternalServerError)
			return
		}

		w.Write([]byte(`{"status":"ok","message":"dashcam.service SHUTDOWN"}`))
	})

	http.HandleFunc("/restart_cam_service", func(w http.ResponseWriter, r *http.Request) {
		log.Println("Restart request received for dashcam.service")

		cmd := exec.Command("sudo", "/usr/bin/systemctl", "restart", "dashcam.service")
		err := cmd.Run()

		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			log.Printf("Failed to restart dashcam.service: %v", err)
			http.Error(w, `{"status":"error","message":"Failed to restart service"}`, http.StatusInternalServerError)
			return
		}

		w.Write([]byte(`{"status":"ok","message":"dashcam.service restarted"}`))
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

	http.HandleFunc("/timeline.m3u8", handleTimelineM3U8)
	http.HandleFunc("/segment_count", handleSegmentCount)

	log.Printf("Serving on :%d...\n", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
}

func handleTimelineM3U8(w http.ResponseWriter, r *http.Request) {
	startParam := r.URL.Query().Get("start")
	startSeg := 0
	if startParam != "" {
		if s, err := strconv.Atoi(startParam); err == nil && s >= 0 {
			startSeg = s
		}
	}

	const maxSegments = 300
	segmentMap := make(map[int]string)

	filepath.WalkDir(recordingsPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		base := filepath.Base(path)
		matches := regexp.MustCompile(`^output_(\d+)\.ts$`).FindStringSubmatch(base)
		if len(matches) == 2 {
			if segNum, err := strconv.Atoi(matches[1]); err == nil {
				relPath := strings.TrimPrefix(path, recordingsPath+"/")
				segmentMap[segNum] = relPath
			}
		}
		return nil
	})

	var segKeys []int
	for k := range segmentMap {
		if k >= startSeg {
			segKeys = append(segKeys, k)
		}
	}
	sort.Ints(segKeys)
	if len(segKeys) > maxSegments {
		segKeys = segKeys[:maxSegments]
	}

	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	fmt.Fprintln(w, "#EXTM3U")
	fmt.Fprintln(w, "#EXT-X-VERSION:3")
	fmt.Fprintln(w, "#EXT-X-TARGETDURATION:2") // take note of this to make sure its correct - need ipc between this and dashcam of some sort
	fmt.Fprintf(w, "#EXT-X-MEDIA-SEQUENCE:%d\n", startSeg)

	for _, k := range segKeys {
		fmt.Fprintln(w, "#EXTINF:2.0,")
		fmt.Fprintf(w, "/recordings/%s\n", segmentMap[k])
	}

	fmt.Fprintln(w, "#EXT-X-ENDLIST")
}

func handleSegmentCount(w http.ResponseWriter, r *http.Request) {
	segmentSet := make(map[int]struct{})
	maxSegment := -1

	filepath.WalkDir(recordingsPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		base := filepath.Base(path)
		matches := regexp.MustCompile(`^output_(\d+)\.ts$`).FindStringSubmatch(base)
		if len(matches) == 2 {
			if segNum, err := strconv.Atoi(matches[1]); err == nil {
				segmentSet[segNum] = struct{}{}
				if segNum > maxSegment {
					maxSegment = segNum
				}
			}
		}
		return nil
	})

	count := len(segmentSet)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(map[string]int{
		"segment_count":  count,
		"latest_segment": maxSegment,
	})
}
