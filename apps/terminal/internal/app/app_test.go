package app

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"testing"
)

func TestHelpPrintsCanonicalGrammar(t *testing.T) {
	result := RunResult([]string{"help"}, strings.NewReader(""))
	if result.Status != 0 {
		t.Fatalf("status = %d stderr=%q", result.Status, result.Stderr)
	}
	for _, want := range []string{"features:", "ooolala send bob", "ooolala upgrade", "ooolala signout", "# download <message-id> <attachment-id>"} {
		if !strings.Contains(result.Stdout, want) {
			t.Fatalf("help missing %q:\n%s", want, result.Stdout)
		}
	}
	if strings.Contains(result.Stdout, "commands:") || strings.Contains(result.Stdout, "ooolala dm ") || strings.Contains(result.Stdout, "ooolala signup") {
		t.Fatalf("help contains removed grammar:\n%s", result.Stdout)
	}
}

func TestNoArgsBootstrapsAuthOnFirstRun(t *testing.T) {
	withServer(t, func(serverURL string) {
		withHome(t, func(home string) {
			t.Setenv("OOOLALA_API", serverURL)
			auth := RunResult(nil, strings.NewReader("user1\n1234\n"))
			who := RunResult([]string{"who"}, strings.NewReader(""))
			if auth.Stdout != "auth user1\n" {
				t.Fatalf("auth stdout = %q stderr=%q", auth.Stdout, auth.Stderr)
			}
			if who.Stdout != "user1\n" {
				t.Fatalf("who stdout = %q", who.Stdout)
			}
			data, err := os.ReadFile(filepath.Join(home, "config"))
			if err != nil {
				t.Fatal(err)
			}
			if string(data) != "handle=user1\nusername=user1\npassword=1234\n" {
				t.Fatalf("config = %q", string(data))
			}
		})
	})
}

func TestRemovedAliasesAreUnsupported(t *testing.T) {
	for _, args := range [][]string{{"-h"}, {"-v"}, {"signup", "user3"}, {"dm", "bob", "hello"}, {"conf"}, {"pw"}} {
		result := RunResult(args, strings.NewReader(""))
		if result.Status != 1 || result.Stderr != "unknown command; try: ooolala help\n" {
			t.Fatalf("%v => status=%d stderr=%q", args, result.Status, result.Stderr)
		}
	}
}

func TestVersionReportsLocalWithoutBackend(t *testing.T) {
	withServer(t, func(serverURL string) {
		t.Setenv("OOOLALA_API", serverURL)
		result := RunResult([]string{"version"}, strings.NewReader(""))
		if result.Status != 0 {
			t.Fatalf("status=%d stderr=%q", result.Status, result.Stderr)
		}
		if !strings.Contains(result.Stdout, "product_version ") {
			t.Fatalf("version missing product version:\n%s", result.Stdout)
		}
		if !strings.Contains(result.Stdout, "backend_status unavailable: not found") {
			t.Fatalf("version missing backend unavailable line:\n%s", result.Stdout)
		}
	})
}

func TestUpgradeDelegatesToInstaller(t *testing.T) {
	dir := t.TempDir()
	installer := filepath.Join(dir, "install.sh")
	log := filepath.Join(dir, "args.txt")
	if err := os.WriteFile(installer, []byte("#!/usr/bin/env bash\nprintf '%s\\n' \"$*\" > "+shellQuote(log)+"\nprintf 'upgraded\\n'\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("OOOLALA_INSTALL", installer)
	t.Setenv("OOOLALA_INSTALL_URL", "")
	result := RunResult([]string{"upgrade"}, strings.NewReader(""))
	if result.Status != 0 || result.Stdout != "upgraded\n" {
		t.Fatalf("upgrade status=%d stdout=%q stderr=%q", result.Status, result.Stdout, result.Stderr)
	}
	data, err := os.ReadFile(log)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "upgrade\n" {
		t.Fatalf("args = %q", string(data))
	}
}

func TestSendReadAttachDownloadAndOpenClose(t *testing.T) {
	withServer(t, func(serverURL string) {
		withHome(t, func(home string) {
			t.Setenv("OOOLALA_API", serverURL)
			note := filepath.Join(home, "note.txt")
			downloads := filepath.Join(home, "downloads")
			if err := os.WriteFile(note, []byte("hello file"), 0o644); err != nil {
				t.Fatal(err)
			}
			auth := RunResult([]string{"auth", "user1"}, strings.NewReader("1234\n"))
			if auth.Status != 0 {
				t.Fatalf("auth status=%d stdout=%q stderr=%q", auth.Status, auth.Stdout, auth.Stderr)
			}
			sent := RunResult([]string{"send", "user2", "see", "attached", "attach", note}, strings.NewReader(""))
			if sent.Status != 0 {
				t.Fatalf("send status=%d stderr=%q", sent.Status, sent.Stderr)
			}
			if !regexp.MustCompile(`user1: see attached \[attachment note\.txt test-message-1/attachment-1\]\n$`).MatchString(sent.Stdout) {
				t.Fatalf("send stdout=%q", sent.Stdout)
			}
			read := RunResult([]string{"read", "user2"}, strings.NewReader(""))
			if read.Stdout != sent.Stdout {
				t.Fatalf("read=%q sent=%q", read.Stdout, sent.Stdout)
			}
			downloaded := RunResult([]string{"download", "test-message-1", "attachment-1", downloads}, strings.NewReader(""))
			if downloaded.Status != 0 {
				t.Fatalf("download status=%d stderr=%q", downloaded.Status, downloaded.Stderr)
			}
			data, err := os.ReadFile(filepath.Join(downloads, "note.txt"))
			if err != nil {
				t.Fatal(err)
			}
			if string(data) != "hello file" {
				t.Fatalf("downloaded data = %q", string(data))
			}
			opened := RunResult([]string{"open", "user2"}, strings.NewReader(""))
			closed := RunResult([]string{"close", "user2"}, strings.NewReader(""))
			if opened.Stdout != "chat user2\n" || closed.Stdout != "closed user2\n" {
				t.Fatalf("open=%q close=%q", opened.Stdout, closed.Stdout)
			}
		})
	})
}

func withHome(t *testing.T, fn func(home string)) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("OOOLALA_HOME", home)
	t.Setenv("OOOLALA_DEFAULT_API_URL", "")
	t.Setenv("OOOLALA_COMMAND_HINT", "")
	t.Setenv("OOOLALA_AUTH_HINT", "")
	t.Setenv("OOOLALA_WELCOME_USER", "")
	fn(home)
}

func withServer(t *testing.T, fn func(serverURL string)) {
	t.Helper()
	users := map[string]string{"user1": "1234", "user2": "1234", "bob": "1234"}
	messages := []backendMessage{}
	attachments := map[string]struct {
		filename    string
		contentType string
		data        []byte
	}{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "POST" && r.URL.Path == "/login":
			_ = r.ParseForm()
			username := cleanUsername(r.Form.Get("username"))
			if users[username] == r.Form.Get("password") {
				fmt.Fprintf(w, "ok %s\n", username)
				return
			}
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
		case r.Method == "GET" && r.URL.Path == "/signup":
			username := cleanUsername(r.URL.Query().Get("username"))
			if !regexp.MustCompile(`^[a-z0-9_][a-z0-9_.-]{1,31}$`).MatchString(username) {
				http.Error(w, "invalid username", http.StatusBadRequest)
				return
			}
			if _, ok := users[username]; ok {
				http.Error(w, "username unavailable", http.StatusConflict)
				return
			}
			fmt.Fprintf(w, "ok %s\n", username)
		case r.Method == "POST" && r.URL.Path == "/signup":
			_ = r.ParseForm()
			username := cleanUsername(r.Form.Get("username"))
			password := r.Form.Get("password")
			if len(password) < 12 {
				http.Error(w, "password must be at least 12 characters", http.StatusBadRequest)
				return
			}
			users[username] = password
			w.WriteHeader(http.StatusCreated)
			fmt.Fprintf(w, "ok %s\n", username)
		case r.Method == "POST" && r.URL.Path == "/password":
			username, password, ok := r.BasicAuth()
			if !ok || users[cleanUsername(username)] != password {
				http.Error(w, "invalid credentials", http.StatusUnauthorized)
				return
			}
			_ = r.ParseForm()
			users[cleanUsername(username)] = r.Form.Get("password")
			fmt.Fprintf(w, "ok %s\n", cleanUsername(username))
		case r.Method == "POST" && r.URL.Path == "/dm":
			username, _, ok := r.BasicAuth()
			author := "user1"
			if ok {
				author = cleanUsername(username)
			}
			_ = r.ParseForm()
			to := r.Form.Get("to")
			messageID := fmt.Sprintf("test-message-%d", len(messages)+1)
			messageAttachments := []backendAttachment{}
			count, _ := strconv.Atoi(r.Form.Get("attachment_count"))
			for idx := 0; idx < count; idx++ {
				id := fmt.Sprintf("attachment-%d", idx+1)
				data, _ := base64.StdEncoding.DecodeString(r.Form.Get(fmt.Sprintf("attachment_%d_data", idx)))
				filename := r.Form.Get(fmt.Sprintf("attachment_%d_filename", idx))
				contentType := r.Form.Get(fmt.Sprintf("attachment_%d_content_type", idx))
				attachments[messageID+"/"+id] = struct {
					filename    string
					contentType string
					data        []byte
				}{filename: filename, contentType: contentType, data: data}
				messageAttachments = append(messageAttachments, backendAttachment{ID: id, Filename: filename, ContentType: contentType, ByteSize: len(data), URL: "/attachments/" + messageID + "/" + id})
			}
			message := backendMessage{ID: messageID, Room: "dm:" + strings.Join(sortedPair(author, to), ":"), Author: author, Body: r.Form.Get("body"), InsertedAt: "2026-05-28T07:00:00Z", Attachments: messageAttachments}
			messages = append(messages, message)
			_ = json.NewEncoder(w).Encode(map[string]backendMessage{"message": message})
		case r.Method == "GET" && r.URL.Path == "/dm":
			username, _, ok := r.BasicAuth()
			if !ok {
				username = "user1"
			}
			peer := r.URL.Query().Get("with")
			room := "dm:" + strings.Join(sortedPair(cleanUsername(username), peer), ":")
			roomMessages := []backendMessage{}
			for _, message := range messages {
				if message.Room == room {
					roomMessages = append(roomMessages, message)
				}
			}
			_ = json.NewEncoder(w).Encode(map[string][]backendMessage{"messages": roomMessages})
		case r.Method == "POST" && r.URL.Path == "/dm/chats":
			_ = r.ParseForm()
			_ = json.NewEncoder(w).Encode(map[string]string{"peer": r.Form.Get("with")})
		case r.Method == "DELETE" && r.URL.Path == "/dm/chats":
			fmt.Fprintf(w, "removed %s\n", r.URL.Query().Get("with"))
		case r.Method == "GET" && strings.HasPrefix(r.URL.Path, "/attachments/"):
			parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/attachments/"), "/")
			item := attachments[parts[0]+"/"+parts[1]]
			if item.filename == "" {
				http.Error(w, "attachment not found", http.StatusNotFound)
				return
			}
			w.Header().Set("content-type", item.contentType)
			w.Header().Set("content-disposition", `attachment; filename="`+item.filename+`"`)
			_, _ = w.Write(item.data)
		default:
			http.Error(w, "not found", http.StatusNotFound)
		}
	}))
	defer server.Close()
	fn(server.URL)
}

func cleanUsername(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func sortedPair(a, b string) []string {
	pair := []string{a, b}
	sort.Strings(pair)
	return pair
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}
