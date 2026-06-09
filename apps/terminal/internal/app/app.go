package app

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ryangerardwilson/ooolala/apps/terminal/internal/tui"
)

const fallbackAPIURL = "https://ooolala.ryangerardwilson.com/api"

var configOrder = []string{"handle", "username", "password"}

type Result struct {
	Status int
	Stdout string
	Stderr string
}

type Credentials struct {
	Username string
	Password string
}

type apiResult struct {
	OK    bool
	Body  string
	Error string
}

type backendMessage struct {
	ID          string              `json:"id"`
	Room        string              `json:"room"`
	Author      string              `json:"author"`
	Body        string              `json:"body"`
	InsertedAt  string              `json:"inserted_at"`
	Attachments []backendAttachment `json:"attachments"`
}

type backendAttachment struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	ByteSize    int    `json:"byte_size"`
	URL         string `json:"url"`
}

type attachmentUpload struct {
	Filename    string
	ContentType string
	Data        []byte
}

type commandError struct {
	message string
}

func (e commandError) Error() string {
	return e.message
}

func Run(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	result := RunResult(args, stdin)
	if result.Stdout != "" {
		fmt.Fprint(stdout, result.Stdout)
	}
	if result.Stderr != "" {
		fmt.Fprint(stderr, result.Stderr)
	}
	return result.Status
}

func RunResult(args []string, stdin io.Reader) Result {
	stdout, err := dispatch(args, stdin)
	if err != nil {
		return Result{Status: 1, Stderr: ensureNewline(errorMessage(err))}
	}
	return Result{Status: 0, Stdout: stdout}
}

func dispatch(args []string, stdin io.Reader) (string, error) {
	if len(args) == 0 {
		if readCredentials() == nil {
			return authCommand(nil, stdin)
		}
		return help(), nil
	}
	if len(args) == 1 && args[0] == "help" {
		return help(), nil
	}
	if len(args) == 1 && args[0] == "upgrade" {
		return upgrade()
	}
	if len(args) == 1 && args[0] == "version" {
		return versionReport()
	}
	switch args[0] {
	case "auth":
		return authCommand(args[1:], stdin)
	case "signout":
		return signoutCommand(args[1:])
	case "password":
		return passwordCommand(args[1:], stdin)
	case "who":
		if len(args) != 1 {
			return "", commandError{"unknown command; try: " + commandName() + " help\n"}
		}
		if credentials := readCredentials(); credentials != nil {
			return credentials.Username + "\n", nil
		}
		return "not authed\n", nil
	case "send":
		return sendCommand(args[1:], stdin)
	case "download":
		return downloadCommand(args[1:])
	case "read":
		return readCommand(args[1:])
	case "watch":
		return watchCommand(args[1:])
	case "open":
		return openCommand(args[1:])
	case "close":
		return closeCommand(args[1:])
	case "tui":
		if len(args) != 1 {
			return "", commandError{"unknown command; try: " + commandName() + " help\n"}
		}
		return "", launchTUI()
	case "config":
		if len(args) != 1 {
			return "", commandError{"unknown command; try: " + commandName() + " help\n"}
		}
		return "", openConfig()
	case "skills":
		if len(args) != 1 {
			return "", commandError{"unknown command; try: " + commandName() + " help\n"}
		}
		return skills()
	default:
		return "", commandError{"unknown command; try: " + commandName() + " help\n"}
	}
}

func help() string {
	name := commandName()
	return fmt.Sprintf(`Ooolala

features:
  inspect the installed client and upgrade through the installer
  # help | version | upgrade
  %[1]s help
  %[1]s version
  %[1]s upgrade

  create or save backend credentials, then inspect or clear local auth
  auth creates the account when the username is free, or signs in when it already exists
  # auth [username] | who | signout | password
  %[1]s auth yourname
  %[1]s auth
  %[1]s who
  %[1]s password
  %[1]s signout

  send direct messages through the backend, including files or stdin
  # send <username> <message> [attach <path> [path ...]] | send <username> -
  %[1]s send bob "hello from the terminal"
  %[1]s send bob "logs attached" attach ./run.log ./screenshots
  echo "hello from stdin" | %[1]s send bob -

  read, watch, open, and close direct-message chats
  # read <username> [last <count>|unread [incoming] [json]] | watch <username> [incoming] | open <username> | close <username>
  %[1]s read bob
  %[1]s read bob last 10
  %[1]s read bob unread
  %[1]s read bob unread incoming
  %[1]s watch bob incoming
  %[1]s open bob
  %[1]s close bob

  download an attachment from a printed message/attachment pair
  # download <message-id> <attachment-id> [dir]
  %[1]s download 20260531123000-AbCdEf note1 .

  launch the terminal UI
  # tui
  %[1]s tui

  open local config or print agent usage instructions
  # config | skills
  %[1]s config
  %[1]s skills
`, name)
}

func authCommand(args []string, stdin io.Reader) (string, error) {
	if len(args) > 1 {
		return "", commandError{"shape: " + commandName() + " auth [username]\n"}
	}
	reader := newPromptReader(stdin)
	username := clean(argAt(args, 0))
	if username == "" {
		username = clean(reader.Read("username: ", false))
	}
	if username == "" {
		return "", commandError{"username required\n"}
	}
	available, resolved, err := usernameAvailability(username)
	if err != nil {
		return "", err
	}
	if available {
		password := clean(reader.Read("password (12+ chars): ", true))
		confirmation := clean(reader.Read("confirm password: ", true))
		if password == "" {
			return "", commandError{"password required\n"}
		}
		if password != confirmation {
			return "", commandError{"passwords did not match\n"}
		}
		response := requestAPI("POST", "/signup", nil, url.Values{"username": {resolved}, "password": {password}})
		if !response.OK {
			return "", commandError{response.Error}
		}
		saved := setCredentials(responseUsername(response.Body, resolved), password)
		return authCreateSuccess(saved), nil
	}
	password := clean(reader.Read("password: ", true))
	if password == "" {
		return "", commandError{"password required\n"}
	}
	response := requestAPI("POST", "/login", nil, url.Values{"username": {resolved}, "password": {password}})
	if !response.OK {
		return "", commandError{response.Error}
	}
	saved := setCredentials(responseUsername(response.Body, resolved), password)
	return "auth " + saved + "\n", nil
}

func usernameAvailability(username string) (bool, string, error) {
	response := requestAPI("GET", "/signup?"+url.Values{"username": {username}}.Encode(), nil, nil)
	if response.OK {
		return true, responseUsername(response.Body, username), nil
	}
	if response.Error == "username unavailable\n" {
		return false, username, nil
	}
	return false, "", commandError{response.Error}
}

func signoutCommand(args []string) (string, error) {
	if len(args) > 0 {
		return "", commandError{"shape: " + commandName() + " signout\n"}
	}
	cfg := readConfig()
	for key := range cfg {
		if key == "handle" || key == "username" || key == "password" || strings.HasPrefix(key, "dm_seen.") {
			delete(cfg, key)
		}
	}
	if err := writeConfig(cfg); err != nil {
		return "", err
	}
	return "signed out\n", nil
}

func passwordCommand(args []string, stdin io.Reader) (string, error) {
	if len(args) > 0 {
		return "", commandError{"shape: " + commandName() + " password\n"}
	}
	credentials, err := requireCredentials()
	if err != nil {
		return "", err
	}
	reader := newPromptReader(stdin)
	password := clean(reader.Read("new password (12+ chars): ", true))
	confirmation := clean(reader.Read("confirm password: ", true))
	if password == "" {
		return "", commandError{"password required\n"}
	}
	if password != confirmation {
		return "", commandError{"passwords did not match\n"}
	}
	response := requestAPI("POST", "/password", credentials, url.Values{"password": {password}})
	if !response.OK {
		return "", commandError{response.Error}
	}
	setCredentials(credentials.Username, password)
	return "password updated\n", nil
}

func sendCommand(args []string, stdin io.Reader) (string, error) {
	if len(args) < 2 {
		return "", commandError{"try: " + commandName() + " send bob \"hello\"\n"}
	}
	username := args[0]
	parts := args[1:]
	attachIndex := indexOf(parts, "attach")
	bodyParts := parts
	attachmentPaths := []string{}
	if attachIndex >= 0 {
		bodyParts = parts[:attachIndex]
		attachmentPaths = parts[attachIndex+1:]
	}
	if attachIndex >= 0 && len(attachmentPaths) == 0 {
		return "", commandError{"try: " + commandName() + " send bob \"logs attached\" attach ./run.log\n"}
	}
	body := strings.Join(bodyParts, " ")
	if len(bodyParts) == 1 && bodyParts[0] == "-" {
		data, _ := io.ReadAll(stdin)
		body = string(data)
	}
	if strings.TrimSpace(body) == "" && len(attachmentPaths) == 0 {
		return "", commandError{"try: " + commandName() + " send bob \"hello\"\n"}
	}
	uploads, cleanup, err := prepareAttachmentUploads(attachmentPaths)
	defer cleanup()
	if err != nil {
		return "", err
	}
	return sendDM(username, body, uploads)
}

func readCommand(args []string) (string, error) {
	if len(args) < 1 {
		return "", commandError{"try: " + commandName() + " read bob\n"}
	}
	username := args[0]
	rest := args[1:]
	if len(rest) == 0 {
		return tailDM(username, -1)
	}
	if len(rest) == 2 && rest[0] == "last" {
		count, err := strconv.Atoi(rest[1])
		if err == nil && count > 0 {
			return tailDM(username, count)
		}
		return "", commandError{"try: " + commandName() + " read bob last 10\n"}
	}
	if rest[0] == "unread" {
		direction, jsonOutput, err := parseUnreadOptions(rest[1:])
		if err != nil {
			return "", err
		}
		credentials, err := requireCredentials()
		if err != nil {
			return "", err
		}
		lines, err := dmLines(credentials, username)
		if err != nil {
			return "", err
		}
		seen := min(dmSeen(credentials.Username, username), len(lines))
		unread := filterLines(lines[seen:], credentials.Username, direction)
		setDMSeen(credentials.Username, username, len(lines))
		if jsonOutput {
			return formatJSONUnread(unread), nil
		}
		if len(unread) == 0 {
			return "no unread\n", nil
		}
		return formatLines(unread, ""), nil
	}
	return "", commandError{"try: " + commandName() + " read bob\n"}
}

func watchCommand(args []string) (string, error) {
	if len(args) < 1 || len(args) > 2 || (len(args) == 2 && args[1] != "incoming") {
		return "", commandError{"try: " + commandName() + " watch bob incoming\n"}
	}
	credentials, err := requireCredentials()
	if err != nil {
		return "", err
	}
	direction := "all"
	if len(args) == 2 {
		direction = "incoming"
	}
	lines, err := dmLines(credentials, args[0])
	if err != nil {
		return "", err
	}
	seen := min(dmSeen(credentials.Username, args[0]), len(lines))
	unread := filterLines(lines[seen:], credentials.Username, direction)
	setDMSeen(credentials.Username, args[0], len(lines))
	fmt.Print(formatLines(unread, ""))
	nextSeen := len(lines)
	for {
		time.Sleep(1500 * time.Millisecond)
		lines, err := dmLines(credentials, args[0])
		if err != nil {
			fmt.Fprint(os.Stderr, errorMessage(err))
			continue
		}
		nextSeen = min(nextSeen, len(lines))
		newLines := filterLines(lines[nextSeen:], credentials.Username, direction)
		if len(newLines) > 0 {
			fmt.Print(formatLines(newLines, ""))
		}
		setDMSeen(credentials.Username, args[0], len(lines))
		nextSeen = len(lines)
	}
}

func openCommand(args []string) (string, error) {
	if len(args) != 1 {
		return "", commandError{"try: " + commandName() + " open bob\n"}
	}
	return startDM(args[0])
}

func closeCommand(args []string) (string, error) {
	if len(args) != 1 {
		return "", commandError{"try: " + commandName() + " close bob\n"}
	}
	credentials, err := requireCredentials()
	if err != nil {
		return "", err
	}
	response := requestAPI("DELETE", "/dm/chats?"+url.Values{"with": {args[0]}}.Encode(), credentials, nil)
	if !response.OK {
		return "", commandError{response.Error}
	}
	return "closed " + strings.TrimSpace(args[0]) + "\n", nil
}

func startDM(username string) (string, error) {
	credentials, err := requireCredentials()
	if err != nil {
		return "", err
	}
	response := requestAPI("POST", "/dm/chats", credentials, url.Values{"with": {username}, "format": {"json"}})
	if !response.OK {
		return "", commandError{response.Error}
	}
	return "chat " + strings.TrimSpace(username) + "\n", nil
}

func tailDM(username string, limit int) (string, error) {
	credentials, err := requireCredentials()
	if err != nil {
		return "", err
	}
	lines, err := dmLines(credentials, username)
	if err != nil {
		return "", err
	}
	setDMSeen(credentials.Username, username, len(lines))
	if limit > 0 && len(lines) > limit {
		lines = lines[len(lines)-limit:]
	}
	return formatLines(lines, "no messages\n"), nil
}

func dmLines(credentials *Credentials, username string) ([]string, error) {
	response := requestAPI("GET", "/dm?"+url.Values{"with": {username}, "format": {"json"}}.Encode(), credentials, nil)
	if !response.OK {
		return nil, commandError{response.Error}
	}
	messages, err := parseMessagesResponse(response.Body)
	if err != nil {
		return nil, err
	}
	return messagesToLines(messages), nil
}

func sendDM(username string, body string, attachments []attachmentUpload) (string, error) {
	credentials, err := requireCredentials()
	if err != nil {
		return "", err
	}
	params := url.Values{"to": {username}, "body": {body}, "format": {"json"}}
	addAttachmentParams(params, attachments)
	response := requestAPI("POST", "/dm", credentials, params)
	if !response.OK {
		return "", commandError{response.Error}
	}
	message, err := parseMessageResponse(response.Body)
	if err != nil {
		return "", err
	}
	return formatLines(messagesToLines([]backendMessage{message}), ""), nil
}

func downloadCommand(args []string) (string, error) {
	if len(args) < 2 || len(args) > 3 {
		return "", commandError{"try: " + commandName() + " download <message-id> <attachment-id> [dir]\n"}
	}
	credentials, err := requireCredentials()
	if err != nil {
		return "", err
	}
	outputDir := "."
	if len(args) == 3 {
		outputDir = args[2]
	}
	req, err := http.NewRequest("GET", strings.TrimRight(apiURL(), "/")+"/attachments/"+url.PathEscape(args[0])+"/"+url.PathEscape(args[1]), nil)
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(credentials.Username, credentials.Password)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	req = req.WithContext(ctx)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", commandError{"backend unavailable: " + strings.TrimSpace(err.Error()) + "\n"}
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode == http.StatusUnauthorized {
		return "", commandError{"invalid credentials\n"}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", commandError{ensureNewline(string(data))}
	}
	filename := responseFilename(resp.Header.Get("content-disposition"))
	if filename == "" {
		filename = args[1] + ".bin"
	}
	dir, err := filepath.Abs(outputDir)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := unusedPath(filepath.Join(dir, filename))
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	return "saved " + path + "\n", nil
}

func versionReport() (string, error) {
	backend := requestAPI("GET", "/version?format=text", nil, nil)
	backendText := ""
	if backend.OK {
		backendText = strings.TrimRight(backend.Body, "\n")
	} else {
		backendText = "backend_status unavailable: " + strings.TrimSpace(backend.Error)
	}
	return fmt.Sprintf("local\n%s\n\nbackend %s\n%s\n", strings.Join(localVersionLines(), "\n"), apiURL(), backendText), nil
}

func localVersionLines() []string {
	env := os.Getenv("OOOLALA_ENV")
	if env == "" {
		env = os.Getenv("NODE_ENV")
	}
	if env == "" {
		env = "client"
	}
	commit := os.Getenv("OOOLALA_COMMIT")
	if commit == "" {
		commit = os.Getenv("GITHUB_SHA")
	}
	if commit == "" {
		commit = "local"
	}
	return []string{
		"product_version " + version(),
		"commit " + commit,
		"environment " + env,
		"command_surface 8",
		"chat_protocol 1..3",
		"auth_policy 7",
		"ui_flow 12",
	}
}

func requestAPI(method, path string, credentials *Credentials, body url.Values) apiResult {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var reader io.Reader
	if body != nil {
		reader = strings.NewReader(body.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(apiURL(), "/")+path, reader)
	if err != nil {
		return apiResult{Error: ensureNewline(err.Error())}
	}
	if credentials != nil {
		req.SetBasicAuth(credentials.Username, credentials.Password)
	}
	if body != nil {
		req.Header.Set("content-type", "application/x-www-form-urlencoded")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return apiResult{Error: "backend unavailable: " + strings.TrimSpace(err.Error()) + "\n"}
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	text := ensureNewline(string(data))
	if resp.StatusCode == http.StatusUnauthorized {
		return apiResult{Error: "invalid credentials\n"}
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return apiResult{Error: text}
	}
	return apiResult{OK: true, Body: text}
}

func parseMessageResponse(body string) (backendMessage, error) {
	var payload struct {
		Message *backendMessage `json:"message"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil || payload.Message == nil {
		return backendMessage{}, commandError{"bad backend message response\n"}
	}
	return *payload.Message, nil
}

func parseMessagesResponse(body string) ([]backendMessage, error) {
	var payload struct {
		Messages []backendMessage `json:"messages"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return nil, commandError{"bad backend messages response\n"}
	}
	return payload.Messages, nil
}

func messagesToLines(messages []backendMessage) []string {
	lines := []string{}
	for _, message := range messages {
		body := strings.Join(strings.Fields(message.Body), " ")
		attachments := ""
		for _, attachment := range message.Attachments {
			attachments += fmt.Sprintf(" [attachment %s %s/%s]", attachment.Filename, message.ID, attachment.ID)
		}
		lines = append(lines, fmt.Sprintf("%s %s %s: %s%s", localTime(message.InsertedAt), message.Room, message.Author, body, attachments))
	}
	return lines
}

func parseTranscriptLine(line string) map[string]string {
	parts := strings.SplitN(line, " ", 4)
	if len(parts) >= 4 && strings.Contains(parts[2], ":") {
		return map[string]string{"time": parts[0], "room": parts[1], "author": strings.TrimSuffix(parts[2], ":"), "body": parts[3]}
	}
	return map[string]string{"body": line}
}

func filterLines(lines []string, currentUsername, direction string) []string {
	if direction == "all" {
		return lines
	}
	filtered := []string{}
	for _, line := range lines {
		if parseTranscriptLine(line)["author"] != currentUsername {
			filtered = append(filtered, line)
		}
	}
	return filtered
}

func parseUnreadOptions(opts []string) (string, bool, error) {
	direction := "all"
	jsonOutput := false
	for _, opt := range opts {
		switch opt {
		case "incoming":
			direction = "incoming"
		case "json":
			jsonOutput = true
		default:
			return "", false, commandError{"try: " + commandName() + " read bob unread incoming\n"}
		}
	}
	return direction, jsonOutput, nil
}

func formatLines(lines []string, empty string) string {
	if len(lines) == 0 {
		return empty
	}
	return strings.Join(lines, "\n") + "\n"
}

func formatJSONUnread(lines []string) string {
	if len(lines) == 0 {
		return ""
	}
	out := strings.Builder{}
	for _, line := range lines {
		data, _ := json.Marshal(parseTranscriptLine(line))
		out.Write(data)
		out.WriteByte('\n')
	}
	return out.String()
}

func readConfig() map[string]string {
	path := configPath()
	data, err := os.ReadFile(path)
	if err != nil {
		return map[string]string{}
	}
	cfg := map[string]string{}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		cfg[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
	}
	return cfg
}

func writeConfig(cfg map[string]string) error {
	if err := os.MkdirAll(filepath.Dir(configPath()), 0o700); err != nil {
		return err
	}
	keys := []string{}
	seen := map[string]bool{}
	for _, key := range configOrder {
		if _, ok := cfg[key]; ok {
			keys = append(keys, key)
			seen[key] = true
		}
	}
	extra := []string{}
	for key := range cfg {
		if !seen[key] {
			extra = append(extra, key)
		}
	}
	sort.Strings(extra)
	keys = append(keys, extra...)
	var body strings.Builder
	for _, key := range keys {
		body.WriteString(key)
		body.WriteByte('=')
		body.WriteString(cfg[key])
		body.WriteByte('\n')
	}
	return os.WriteFile(configPath(), []byte(body.String()), 0o600)
}

func readCredentials() *Credentials {
	cfg := readConfig()
	username := cfg["username"]
	password := cfg["password"]
	if username != "" && password != "" {
		return &Credentials{Username: username, Password: password}
	}
	return nil
}

func requireCredentials() (*Credentials, error) {
	credentials := readCredentials()
	if credentials == nil {
		return nil, commandError{"not authed; run " + authHint() + "\n"}
	}
	return credentials, nil
}

func setCredentials(username, password string) string {
	nextUsername := clean(username)
	cfg := readConfig()
	cfg["username"] = nextUsername
	cfg["password"] = clean(password)
	if cfg["handle"] == "" {
		cfg["handle"] = nextUsername
	}
	_ = writeConfig(cfg)
	return nextUsername
}

func dmSeen(username, peer string) int {
	value, _ := strconv.Atoi(readConfig()[dmSeenKey(username, peer)])
	if value < 0 {
		return 0
	}
	return value
}

func setDMSeen(username, peer string, count int) {
	cfg := readConfig()
	cfg[dmSeenKey(username, peer)] = strconv.Itoa(max(0, count))
	_ = writeConfig(cfg)
}

func dmSeenKey(username, peer string) string {
	return "dm_seen." + clean(username) + "." + clean(peer)
}

func prepareAttachmentUploads(paths []string) ([]attachmentUpload, func(), error) {
	uploads := []attachmentUpload{}
	cleanupPaths := []string{}
	cleanup := func() {
		for _, path := range cleanupPaths {
			_ = os.RemoveAll(path)
		}
	}
	for _, raw := range paths {
		path, filename, cleanupDir, err := prepareAttachmentPath(raw)
		if err != nil {
			cleanup()
			return nil, func() {}, err
		}
		if cleanupDir != "" {
			cleanupPaths = append(cleanupPaths, cleanupDir)
		}
		data, err := os.ReadFile(path)
		if err != nil {
			cleanup()
			return nil, func() {}, err
		}
		uploads = append(uploads, attachmentUpload{Filename: filename, ContentType: contentTypeFor(filename), Data: data})
	}
	if err := enforceAttachmentLimits(uploads); err != nil {
		cleanup()
		return nil, func() {}, err
	}
	return uploads, cleanup, nil
}

func prepareAttachmentPath(input string) (string, string, string, error) {
	path, err := filepath.Abs(input)
	if err != nil {
		return "", "", "", err
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", "", "", commandError{"attachment not found: " + input + "\n"}
	}
	if info.Mode().IsRegular() {
		return path, filepath.Base(path), "", nil
	}
	if info.IsDir() {
		return archiveDirectory(path)
	}
	return "", "", "", commandError{"attachment must be a file or directory: " + input + "\n"}
}

func archiveDirectory(path string) (string, string, string, error) {
	temp, err := os.MkdirTemp("", "ooolala-attach-*")
	if err != nil {
		return "", "", "", err
	}
	name := filepath.Base(strings.TrimRight(path, string(os.PathSeparator)))
	if name == "" {
		name = "attachment"
	}
	zipPath := filepath.Join(temp, name+".zip")
	if err := zipPathFromDir(path, zipPath); err != nil {
		_ = os.RemoveAll(temp)
		return "", "", "", err
	}
	return zipPath, name + ".zip", temp, nil
}

func zipPathFromDir(root, target string) error {
	out, err := os.Create(target)
	if err != nil {
		return err
	}
	defer out.Close()
	writer := zip.NewWriter(out)
	defer writer.Close()
	return filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if path == root {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		rel = filepath.ToSlash(rel)
		if d.IsDir() {
			_, err := writer.Create(rel + "/")
			return err
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()
		part, err := writer.Create(rel)
		if err != nil {
			return err
		}
		_, err = io.Copy(part, file)
		return err
	})
}

func addAttachmentParams(params url.Values, attachments []attachmentUpload) {
	params.Set("attachment_count", strconv.Itoa(len(attachments)))
	for idx, attachment := range attachments {
		key := strconv.Itoa(idx)
		params.Set("attachment_"+key+"_filename", attachment.Filename)
		params.Set("attachment_"+key+"_content_type", attachment.ContentType)
		params.Set("attachment_"+key+"_data", base64.StdEncoding.EncodeToString(attachment.Data))
	}
}

func enforceAttachmentLimits(uploads []attachmentUpload) error {
	maxCount := envInteger("OOOLALA_MAX_ATTACHMENTS", 5)
	maxBytes := envInteger("OOOLALA_MAX_ATTACHMENT_BYTES", 5*1024*1024)
	maxTotal := envInteger("OOOLALA_MAX_ATTACHMENTS_TOTAL_BYTES", 15*1024*1024)
	total := 0
	if len(uploads) > maxCount {
		return commandError{fmt.Sprintf("too many attachments; max %d\n", maxCount)}
	}
	for _, upload := range uploads {
		size := len(upload.Data)
		total += size
		if size == 0 {
			return commandError{"attachment is empty: " + upload.Filename + "\n"}
		}
		if size > maxBytes {
			return commandError{fmt.Sprintf("attachment too large: %s max %s\n", upload.Filename, formatBytes(maxBytes))}
		}
	}
	if total > maxTotal {
		return commandError{"attachments too large; max " + formatBytes(maxTotal) + " total\n"}
	}
	return nil
}

func contentTypeFor(filename string) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".txt", ".log", ".md":
		return "text/plain"
	case ".json":
		return "application/json"
	case ".csv":
		return "text/csv"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".pdf":
		return "application/pdf"
	case ".zip":
		return "application/zip"
	case ".gz":
		return "application/gzip"
	default:
		return "application/octet-stream"
	}
}

func responseFilename(disposition string) string {
	_, params, err := mime.ParseMediaType(disposition)
	if err == nil && params["filename"] != "" {
		return filepath.Base(params["filename"])
	}
	return ""
}

func unusedPath(path string) string {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return path
	}
	dir := filepath.Dir(path)
	ext := filepath.Ext(path)
	stem := strings.TrimSuffix(filepath.Base(path), ext)
	for idx := 1; idx < 1000; idx++ {
		candidate := filepath.Join(dir, fmt.Sprintf("%s-%d%s", stem, idx, ext))
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
	}
	return path
}

func openConfig() error {
	if err := os.MkdirAll(filepath.Dir(configPath()), 0o700); err != nil {
		return err
	}
	if _, err := os.Stat(configPath()); os.IsNotExist(err) {
		if err := os.WriteFile(configPath(), nil, 0o600); err != nil {
			return err
		}
	}
	parts := editorCommand()
	cmd := exec.Command(parts[0], append(parts[1:], configPath())...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return commandError{err.Error() + "\n"}
	}
	return nil
}

func editorCommand() []string {
	editor := os.Getenv("VISUAL")
	if editor == "" {
		editor = os.Getenv("EDITOR")
	}
	if editor == "" {
		editor = "vim"
	}
	parts := strings.Fields(editor)
	if len(parts) == 0 {
		parts = []string{"vim"}
	}
	base := filepath.Base(parts[0])
	if (base == "vi" || base == "vim" || base == "nvim") && !contains(parts[1:], "-n") {
		return append([]string{parts[0], "-n"}, parts[1:]...)
	}
	return parts
}

func launchTUI() error {
	credentials, err := requireCredentials()
	if err != nil {
		return err
	}
	return tui.Run(tui.Config{
		APIURL:      apiURL(),
		AppName:     commandName(),
		AuthHint:    authHint(),
		Username:    credentials.Username,
		Password:    credentials.Password,
		RequestFunc: requestForTUI,
	})
}

func requestForTUI(method, path string, credentials tui.Credentials, body url.Values) (string, error) {
	response := requestAPI(method, path, &Credentials{Username: credentials.Username, Password: credentials.Password}, body)
	if !response.OK {
		return "", commandError{response.Error}
	}
	return response.Body, nil
}

func skills() (string, error) {
	path := filepath.Join(sourceRoot(), "SKILLS.md")
	data, err := os.ReadFile(path)
	if err != nil {
		return "", commandError{"SKILLS.md not found; run " + commandName() + " upgrade and try again\n"}
	}
	return ensureNewline(string(data)), nil
}

func upgrade() (string, error) {
	if installerURL := os.Getenv("OOOLALA_INSTALL_URL"); installerURL != "" {
		return runCaptured("sh", []string{"-c", `curl -fsSL "$1" | bash`, "ooolala-upgrade", installerURL})
	}
	installer := os.Getenv("OOOLALA_INSTALL")
	if installer == "" {
		installer = filepath.Join(sourceRoot(), "install.sh")
	}
	if _, err := os.Stat(installer); err == nil {
		return runCaptured(installer, []string{"upgrade"})
	}
	return "", commandError{"installer not found; set OOOLALA_INSTALL_URL or OOOLALA_INSTALL\n"}
}

func runCaptured(command string, args []string) (string, error) {
	cmd := exec.Command(command, args...)
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	if err := cmd.Run(); err != nil {
		if out.Len() > 0 {
			return "", commandError{out.String()}
		}
		return "", commandError{err.Error() + "\n"}
	}
	return out.String(), nil
}

func sourceRoot() string {
	if value := os.Getenv("OOOLALA_SOURCE"); value != "" {
		return value
	}
	if value := os.Getenv("OOOLALA_INSTALL"); value != "" {
		return filepath.Dir(value)
	}
	wd, _ := os.Getwd()
	for dir := wd; dir != "/" && dir != "."; dir = filepath.Dir(dir) {
		if _, err := os.Stat(filepath.Join(dir, "VERSION")); err == nil {
			return dir
		}
	}
	return wd
}

func version() string {
	data, err := os.ReadFile(filepath.Join(sourceRoot(), "VERSION"))
	if err != nil {
		return "0.0.0"
	}
	return strings.TrimSpace(string(data))
}

func appHome() string {
	if home := os.Getenv("OOOLALA_HOME"); home != "" {
		return home
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "."+commandName())
}

func configPath() string {
	return filepath.Join(appHome(), "config")
}

func apiURL() string {
	if value := os.Getenv("OOOLALA_API"); value != "" {
		return value
	}
	if value := os.Getenv("OOOLALA_DEFAULT_API_URL"); value != "" {
		return value
	}
	return fallbackAPIURL
}

func commandName() string {
	if value := os.Getenv("OOOLALA_APP"); value != "" {
		return value
	}
	return "ooolala"
}

func commandHint() string {
	if value := os.Getenv("OOOLALA_COMMAND_HINT"); value != "" {
		return value
	}
	return commandName()
}

func authHint() string {
	if value := os.Getenv("OOOLALA_AUTH_HINT"); value != "" {
		return value
	}
	return commandName() + " auth <username>"
}

func welcomeUser() string {
	if value := os.Getenv("OOOLALA_WELCOME_USER"); value != "" {
		return value
	}
	return "bob"
}

type promptReader struct {
	scanner *bufio.Scanner
}

func newPromptReader(stdin io.Reader) *promptReader {
	return &promptReader{scanner: bufio.NewScanner(stdin)}
}

func (r *promptReader) Read(_ string, _ bool) string {
	if !r.scanner.Scan() {
		return ""
	}
	return r.scanner.Text()
}

func clean(value string) string {
	return strings.TrimSpace(value)
}

func responseUsername(body, fallback string) string {
	fields := strings.Fields(body)
	if len(fields) >= 2 && fields[0] == "ok" {
		return fields[1]
	}
	return fallback
}

func authCreateSuccess(username string) string {
	return fmt.Sprintf("created and signed in as %s\ntry: %s send %s \"hello\"\n", username, commandHint(), welcomeUser())
}

func localTime(raw string) string {
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return raw
	}
	return t.Local().Format("15:04:05")
}

func formatBytes(bytes int) string {
	if bytes >= 1024*1024 {
		return fmt.Sprintf("%d MiB", bytes/(1024*1024))
	}
	if bytes >= 1024 {
		return fmt.Sprintf("%d KiB", bytes/1024)
	}
	return fmt.Sprintf("%d bytes", bytes)
}

func envInteger(name string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(name))
	if err == nil && value > 0 {
		return value
	}
	return fallback
}

func ensureNewline(value string) string {
	if value == "" || strings.HasSuffix(value, "\n") {
		return value
	}
	return value + "\n"
}

func errorMessage(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func argAt(args []string, idx int) string {
	if idx >= 0 && idx < len(args) {
		return args[idx]
	}
	return ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func indexOf(values []string, target string) int {
	for idx, value := range values {
		if value == target {
			return idx
		}
	}
	return -1
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
