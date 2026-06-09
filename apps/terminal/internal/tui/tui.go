package tui

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type Credentials struct {
	Username string
	Password string
}

type Config struct {
	APIURL      string
	AppName     string
	AuthHint    string
	Username    string
	Password    string
	RequestFunc func(method, path string, credentials Credentials, body url.Values) (string, error)
}

type message struct {
	ID          string       `json:"id"`
	Room        string       `json:"room"`
	Author      string       `json:"author"`
	Body        string       `json:"body"`
	InsertedAt  string       `json:"inserted_at"`
	Attachments []attachment `json:"attachments"`
}

type attachment struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	ByteSize    int    `json:"byte_size"`
}

type model struct {
	cfg         Config
	step        string
	peers       []string
	selected    int
	activePeer  string
	messages    []message
	status      string
	peerInput   textinput.Model
	draftInput  textinput.Model
	deleteArmed bool
	width       int
	height      int
}

type peersMsg struct {
	peers []string
	err   error
}

type messagesMsg struct {
	peer     string
	messages []message
	err      error
}

type statusMsg struct {
	status string
	err    error
}

var (
	titleStyle  = lipgloss.NewStyle().Bold(true)
	activeStyle = lipgloss.NewStyle().Foreground(lipgloss.Color("14")).Bold(true)
	mutedStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("8"))
	errorStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("11"))
)

func Run(cfg Config) error {
	peer := textinput.New()
	peer.Placeholder = "bob"
	peer.Prompt = "user "
	draft := textinput.New()
	draft.Prompt = "> "
	program := tea.NewProgram(model{cfg: cfg, step: "chats", peerInput: peer, draftInput: draft}, tea.WithAltScreen())
	_, err := program.Run()
	return err
}

func (m model) Init() tea.Cmd {
	return m.loadPeers()
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch typed := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = typed.Width
		m.height = typed.Height
	case peersMsg:
		if typed.err != nil {
			m.status = typed.err.Error()
		} else {
			m.peers = typed.peers
			m.selected = clamp(m.selected, 0, len(m.peers)-1)
			m.status = ""
		}
	case messagesMsg:
		if typed.err != nil {
			m.status = typed.err.Error()
		} else {
			m.activePeer = typed.peer
			m.messages = typed.messages
			m.step = "chat"
			m.status = ""
			m.draftInput.Focus()
		}
	case statusMsg:
		if typed.err != nil {
			m.status = typed.err.Error()
		} else {
			m.status = typed.status
		}
	case tea.KeyMsg:
		key := typed.String()
		if key == "ctrl+c" || key == "q" && m.step == "chats" {
			return m, tea.Quit
		}
		if key == "esc" {
			m.deleteArmed = false
			if m.step == "chat" || m.step == "newPeer" {
				m.step = "chats"
				m.peerInput.Blur()
				m.draftInput.Blur()
				return m, nil
			}
		}
		switch m.step {
		case "chats":
			return m.updateChats(key)
		case "newPeer":
			return m.updateNewPeer(typed)
		case "chat":
			return m.updateChat(typed)
		}
	}
	return m, nil
}

func (m model) updateChats(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "j", "down":
		m.selected = clamp(m.selected+1, 0, len(m.peers)-1)
		m.deleteArmed = false
	case "k", "up":
		m.selected = clamp(m.selected-1, 0, len(m.peers)-1)
		m.deleteArmed = false
	case "n":
		m.step = "newPeer"
		m.peerInput.SetValue("")
		m.peerInput.Focus()
		m.deleteArmed = false
	case "d":
		if len(m.peers) == 0 {
			break
		}
		if !m.deleteArmed {
			m.deleteArmed = true
			m.status = "press d again to remove chat"
			break
		}
		peer := m.peers[m.selected]
		m.deleteArmed = false
		return m, m.closePeer(peer)
	case "enter", "l":
		if len(m.peers) == 0 {
			break
		}
		return m, m.openPeer(m.peers[m.selected])
	default:
		if len(key) == 1 && key[0] >= '1' && key[0] <= '9' {
			idx := int(key[0] - '1')
			if idx < len(m.peers) {
				m.selected = idx
				return m, m.openPeer(m.peers[idx])
			}
		}
		m.deleteArmed = false
	}
	return m, nil
}

func (m model) updateNewPeer(key tea.KeyMsg) (tea.Model, tea.Cmd) {
	if key.String() == "enter" {
		peer := strings.TrimSpace(m.peerInput.Value())
		if peer == "" {
			return m, nil
		}
		return m, m.openPeer(peer)
	}
	var cmd tea.Cmd
	m.peerInput, cmd = m.peerInput.Update(key)
	return m, cmd
}

func (m model) updateChat(key tea.KeyMsg) (tea.Model, tea.Cmd) {
	if key.String() == "enter" {
		body := strings.TrimSpace(m.draftInput.Value())
		if body == "" {
			return m, nil
		}
		m.draftInput.SetValue("")
		return m, m.sendMessage(m.activePeer, body)
	}
	var cmd tea.Cmd
	m.draftInput, cmd = m.draftInput.Update(key)
	return m, cmd
}

func (m model) View() string {
	var b strings.Builder
	width := m.width
	if width <= 0 {
		width = 88
	}
	fmt.Fprintf(&b, "%s  %s  %s\n\n", titleStyle.Render("ooolala"), activeStyle.Render(m.cfg.Username), mutedStyle.Render(m.cfg.APIURL))
	switch m.step {
	case "chats":
		b.WriteString(m.chatsView(width))
	case "newPeer":
		b.WriteString("new chat\n")
		b.WriteString(m.peerInput.View())
		b.WriteByte('\n')
	case "chat":
		b.WriteString(m.chatView(width))
	}
	if m.status != "" {
		style := mutedStyle
		if strings.Contains(strings.ToLower(m.status), "invalid") || strings.Contains(strings.ToLower(m.status), "unavailable") {
			style = errorStyle
		}
		fmt.Fprintf(&b, "\n%s\n", style.Render(m.status))
	}
	return b.String()
}

func (m model) chatsView(width int) string {
	var b strings.Builder
	b.WriteString(mutedStyle.Render("chats") + "\n")
	if len(m.peers) == 0 {
		b.WriteString(mutedStyle.Render("no chats yet") + "\n")
	} else {
		for idx, peer := range m.peers {
			prefix := "  "
			style := lipgloss.NewStyle().Foreground(lipgloss.Color("8"))
			if idx == m.selected {
				prefix = "> "
				style = activeStyle
			}
			b.WriteString(style.Render(truncate(fmt.Sprintf("%s%d @%s", prefix, idx+1, peer), width)))
			b.WriteByte('\n')
		}
	}
	b.WriteString("\n")
	b.WriteString(mutedStyle.Render("n new chat  dd remove  enter open  q quit"))
	b.WriteByte('\n')
	return b.String()
}

func (m model) chatView(width int) string {
	var b strings.Builder
	fmt.Fprintf(&b, "peer %s\n\n", activeStyle.Render("@"+m.activePeer))
	if len(m.messages) == 0 {
		b.WriteString(mutedStyle.Render("no messages") + "\n")
	} else {
		for _, message := range m.messages {
			body := strings.Join(strings.Fields(message.Body), " ")
			timestamp := localTime(message.InsertedAt)
			author := message.Author
			line := fmt.Sprintf("%s %s: %s", timestamp, author, body)
			if author == m.cfg.Username {
				b.WriteString(activeStyle.Render(truncate(line, width)))
			} else {
				b.WriteString(truncate(line, width))
			}
			b.WriteByte('\n')
			for _, attachment := range message.Attachments {
				b.WriteString(mutedStyle.Render(truncate(fmt.Sprintf("  @ %s %s/%s", attachment.Filename, message.ID, attachment.ID), width)))
				b.WriteByte('\n')
			}
		}
	}
	b.WriteString("\n")
	b.WriteString(m.draftInput.View())
	b.WriteByte('\n')
	return b.String()
}

func (m model) loadPeers() tea.Cmd {
	return func() tea.Msg {
		body, err := m.cfg.RequestFunc("GET", "/dm/peers?"+url.Values{"format": {"json"}}.Encode(), Credentials{Username: m.cfg.Username, Password: m.cfg.Password}, nil)
		if err != nil {
			return peersMsg{err: err}
		}
		var payload struct {
			Peers []string `json:"peers"`
		}
		if err := json.Unmarshal([]byte(body), &payload); err != nil {
			return peersMsg{err: err}
		}
		return peersMsg{peers: uniq(payload.Peers)}
	}
}

func (m model) openPeer(peer string) tea.Cmd {
	return func() tea.Msg {
		creds := Credentials{Username: m.cfg.Username, Password: m.cfg.Password}
		if _, err := m.cfg.RequestFunc("POST", "/dm/chats", creds, url.Values{"with": {peer}, "format": {"json"}}); err != nil {
			return messagesMsg{err: err}
		}
		body, err := m.cfg.RequestFunc("GET", "/dm?"+url.Values{"with": {peer}, "format": {"json"}}.Encode(), creds, nil)
		if err != nil {
			return messagesMsg{err: err}
		}
		messages, err := parseMessages(body)
		if err != nil {
			return messagesMsg{err: err}
		}
		return messagesMsg{peer: strings.TrimSpace(peer), messages: messages}
	}
}

func (m model) closePeer(peer string) tea.Cmd {
	return func() tea.Msg {
		creds := Credentials{Username: m.cfg.Username, Password: m.cfg.Password}
		if _, err := m.cfg.RequestFunc("DELETE", "/dm/chats?"+url.Values{"with": {peer}}.Encode(), creds, nil); err != nil {
			return statusMsg{err: err}
		}
		return peersMsg{peers: removeValue(m.peers, peer)}
	}
}

func (m model) sendMessage(peer, body string) tea.Cmd {
	return func() tea.Msg {
		creds := Credentials{Username: m.cfg.Username, Password: m.cfg.Password}
		response, err := m.cfg.RequestFunc("POST", "/dm", creds, url.Values{"to": {peer}, "body": {body}, "format": {"json"}})
		if err != nil {
			return statusMsg{err: err}
		}
		var payload struct {
			Message message `json:"message"`
		}
		if err := json.Unmarshal([]byte(response), &payload); err != nil {
			return statusMsg{err: err}
		}
		next := append(append([]message(nil), m.messages...), payload.Message)
		return messagesMsg{peer: peer, messages: next}
	}
}

func parseMessages(body string) ([]message, error) {
	var payload struct {
		Messages []message `json:"messages"`
	}
	if err := json.Unmarshal([]byte(body), &payload); err != nil {
		return nil, err
	}
	return payload.Messages, nil
}

func uniq(values []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}

func removeValue(values []string, target string) []string {
	out := []string{}
	for _, value := range values {
		if value != target {
			out = append(out, value)
		}
	}
	return out
}

func localTime(raw string) string {
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return raw
	}
	return t.Local().Format("15:04:05")
}

func truncate(value string, width int) string {
	if width <= 4 || len(value) <= width {
		return value
	}
	return value[:width-3] + "..."
}

func clamp(value, low, high int) int {
	if high < low {
		return 0
	}
	if value < low {
		return low
	}
	if value > high {
		return high
	}
	return value
}
