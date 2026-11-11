"""Real-time live database dashboard server for Audit-V.
Continuously reads audit_v_users.db and auto-refreshes the browser dashboard every 1.5s.
"""
from __future__ import annotations

import json
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import webbrowser

PORT = 8555
BASE_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BASE_DIR / "audit_v_users.db"


def get_live_db_payload() -> dict:
    if not DB_PATH.exists():
        return {"error": "Database not found"}

    try:
        conn = sqlite3.connect(f"file:{DB_PATH.resolve()}?mode=ro", uri=True)
    except Exception:
        conn = sqlite3.connect(DB_PATH)

    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in cursor.fetchall()]

    result = {}
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table});")
        columns = [c[1] for c in cursor.fetchall()]

        # Order by id DESC if table has id column
        order_clause = "ORDER BY id DESC" if "id" in columns else ""
        cursor.execute(f"SELECT * FROM {table} {order_clause};")
        rows = [dict(r) for r in cursor.fetchall()]

        processed_rows = []
        for r in rows:
            display_row = dict(r)
            if "hashed_password" in display_row and display_row["hashed_password"]:
                display_row["hashed_password"] = display_row["hashed_password"][:12] + "..."
            for k, v in display_row.items():
                if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
                    try:
                        display_row[k] = json.loads(v)
                    except Exception:
                        pass
            processed_rows.append(display_row)

        result[table] = {"columns": columns, "rows": processed_rows}

    conn.close()
    return result


DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit-V Live Database Monitor (Auto-Updating)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(17, 24, 39, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.25);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --badge-bg: rgba(59, 130, 246, 0.15);
      --badge-text: #60a5fa;
      --table-header: #1e293b;
      --table-row-hover: rgba(59, 130, 246, 0.08);
      --highlight: rgba(16, 185, 129, 0.2);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: radial-gradient(circle at top right, #1e1b4b 0%, var(--bg) 60%);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 1350px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 1.5rem;
    }
    .logo-group h1 {
      font-size: 1.75rem;
      font-weight: 700;
      background: linear-gradient(135deg, #60a5fa, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid rgba(16, 185, 129, 0.3);
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.2);
    }
    .pulse-dot {
      width: 9px;
      height: 9px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1.15); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    .stat-card:hover, .stat-card.active {
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 6px 24px var(--accent-glow);
    }
    .stat-card h3 {
      font-size: 0.85rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .stat-card .count {
      font-size: 2.2rem;
      font-weight: 700;
      color: #fff;
    }
    .controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      gap: 1rem;
    }
    .search-input {
      background: rgba(18, 24, 38, 0.9);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 0.65rem 1rem;
      color: #fff;
      font-family: inherit;
      width: 320px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: var(--accent);
    }
    .table-section {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      overflow: hidden;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .table-wrapper {
      overflow-x: auto;
      max-height: 65vh;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }
    th {
      background: var(--table-header);
      padding: 0.85rem 1rem;
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    td {
      padding: 0.85rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      color: var(--text);
      vertical-align: top;
      max-width: 480px;
      word-break: break-word;
    }
    tr:hover td {
      background: var(--table-row-hover);
    }
    .json-code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      background: rgba(0,0,0,0.4);
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      display: inline-block;
      max-height: 130px;
      overflow-y: auto;
      color: #93c5fd;
    }
    .role-badge {
      display: inline-block;
      padding: 0.2rem 0.55rem;
      border-radius: 5px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .role-user { background: rgba(59, 130, 246, 0.25); color: #60a5fa; border: 1px solid rgba(59,130,246,0.4); }
    .role-assistant { background: rgba(168, 85, 247, 0.25); color: #c084fc; border: 1px solid rgba(168,85,247,0.4); }
    .flash-new {
      animation: flashGreen 2s ease-out;
    }
    @keyframes flashGreen {
      0% { background: rgba(16, 185, 129, 0.35); }
      100% { background: transparent; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-group">
        <h1>Audit-V Live Database Monitor</h1>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.35rem;">Live File: <code>audit_v_users.db</code> &bull; Real-time auto-refreshing</p>
      </div>
      <div class="status-badge">
        <span class="pulse-dot" id="liveDot"></span>
        <span id="liveStatusText">Live Sync: Active (Polling every 1.5s)</span>
      </div>
    </header>

    <div class="stats-grid" id="statsGrid"></div>

    <div class="controls">
      <h2 id="activeTableTitle" style="font-size: 1.25rem; font-weight: 600;">Table Data</h2>
      <input type="text" id="searchInput" class="search-input" placeholder="Live search in active table...">
    </div>

    <div class="table-section">
      <div class="table-wrapper">
        <table id="dataTable">
          <thead id="tableHead"></thead>
          <tbody id="tableBody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    let data = {};
    let currentTable = 'user_chat_messages';
    let previousCounts = {};

    async function pollLiveDb() {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) throw new Error('API response not OK');
        const freshData = await res.json();
        
        let hasChanges = false;
        Object.keys(freshData).forEach(t => {
          const newLen = freshData[t].rows.length;
          if (previousCounts[t] !== undefined && previousCounts[t] !== newLen) {
            hasChanges = true;
          }
          previousCounts[t] = newLen;
        });

        data = freshData;
        if (!data[currentTable] && Object.keys(data).length > 0) {
          currentTable = Object.keys(data)[0];
        }

        renderStats();
        renderTable();

        const now = new Date().toLocaleTimeString();
        document.getElementById('liveStatusText').innerText = `Live Connected (Last synced: ${now})`;
        document.getElementById('liveDot').style.background = '#10b981';
      } catch (err) {
        document.getElementById('liveStatusText').innerText = 'Sync interrupted (Retrying...)';
        document.getElementById('liveDot').style.background = '#f59e0b';
      }
    }

    function renderStats() {
      const grid = document.getElementById('statsGrid');
      const tableNames = Object.keys(data);
      grid.innerHTML = '';
      tableNames.forEach(t => {
        const card = document.createElement('div');
        card.className = `stat-card ${t === currentTable ? 'active' : ''}`;
        card.innerHTML = `<h3>${t}</h3><div class="count">${data[t].rows.length}</div>`;
        card.onclick = () => {
          currentTable = t;
          document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          renderTable();
        };
        grid.appendChild(card);
      });
    }

    function renderTable() {
      if (!data[currentTable]) return;
      const tData = data[currentTable];
      document.getElementById('activeTableTitle').innerText = `${currentTable} (${tData.rows.length} records, latest on top)`;
      const thead = document.getElementById('tableHead');
      const tbody = document.getElementById('tableBody');
      const query = document.getElementById('searchInput').value.toLowerCase();

      thead.innerHTML = '<tr>' + tData.columns.map(c => `<th>${c}</th>`).join('') + '</tr>';
      
      const filtered = tData.rows.filter(row => {
        if (!query) return true;
        return Object.values(row).some(v => String(v).toLowerCase().includes(query));
      });

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${tData.columns.length}" style="text-align:center; padding: 2.5rem; color: #9ca3af;">No records in ${currentTable}.</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(row => {
        return '<tr>' + tData.columns.map(c => {
          let val = row[c];
          if (c === 'role') {
            return `<td><span class="role-badge role-${val}">${val}</span></td>`;
          }
          if (c === 'data' || (typeof val === 'object' && val !== null)) {
            return `<td><pre class="json-code">${JSON.stringify(val, null, 2)}</pre></td>`;
          }
          if (c === 'content' && typeof val === 'string' && val.length > 70) {
            return `<td><div style="max-height: 130px; overflow-y: auto; white-space: pre-wrap;">${val}</div></td>`;
          }
          return `<td>${val !== null ? val : '<span style="color:#6b7280">null</span>'}</td>`;
        }).join('') + '</tr>';
      }).join('');
    }

    document.getElementById('searchInput').addEventListener('input', renderTable);
    pollLiveDb();
    setInterval(pollLiveDb, 1500); // Poll every 1.5s
  </script>
</body>
</html>
"""


class DashboardRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress noisy request logging for clean console
        pass

    def do_GET(self):
        if self.path == "/api/data":
            payload = get_live_db_payload()
            raw = json.dumps(payload, default=str).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            self.wfile.write(raw)
            return

        # Serve Dashboard HTML
        raw = DASHBOARD_HTML.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(raw)


def run():
    server = HTTPServer(("127.0.0.1", PORT), DashboardRequestHandler)
    print("=" * 70)
    print(f"AUDIT-V LIVE DATABASE DASHBOARD RUNNING")
    print(f"URL: http://127.0.0.1:{PORT}")
    print(f"Polling database: {DB_PATH.resolve()}")
    print("=" * 70)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        server.server_close()


if __name__ == "__main__":
    run()
