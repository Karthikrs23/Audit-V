"""Utility script to inspect and display the live Audit-V SQLite database contents."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / "audit_v_users.db"


def generate_html_viewer(tables_data: dict, output_path: Path):
    """Generate a modern, beautiful standalone HTML dashboard to inspect the DB visually."""
    data_json = json.dumps(tables_data, default=str)
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit-V Live Database Storage Viewer</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg: #0b0f19;
      --card-bg: rgba(18, 24, 38, 0.85);
      --card-border: rgba(255, 255, 255, 0.08);
      --accent: #3b82f6;
      --accent-glow: rgba(59, 130, 246, 0.25);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --badge-bg: rgba(59, 130, 246, 0.15);
      --badge-text: #60a5fa;
      --table-header: #1e293b;
      --table-row-hover: rgba(59, 130, 246, 0.08);
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: radial-gradient(circle at top right, #1e1b4b 0%, var(--bg) 60%);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem;
    }}
    .container {{
      max-width: 1300px;
      margin: 0 auto;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 1.5rem;
    }}
    .logo-group h1 {{
      font-size: 1.75rem;
      font-weight: 700;
      background: linear-gradient(135deg, #60a5fa, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }}
    .status-badge {{
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      padding: 0.4rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }}
    .pulse-dot {{
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 10px #10b981;
    }}
    .stats-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }}
    .stat-card {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1.25rem;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      transition: all 0.2s ease;
    }}
    .stat-card:hover, .stat-card.active {{
      border-color: var(--accent);
      transform: translateY(-2px);
      box-shadow: 0 6px 24px var(--accent-glow);
    }}
    .stat-card h3 {{
      font-size: 0.85rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }}
    .stat-card .count {{
      font-size: 2rem;
      font-weight: 700;
      color: #fff;
    }}
    .controls {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
      gap: 1rem;
    }}
    .search-input {{
      background: rgba(18, 24, 38, 0.9);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 0.65rem 1rem;
      color: #fff;
      font-family: inherit;
      width: 320px;
      outline: none;
      transition: border-color 0.2s;
    }}
    .search-input:focus {{
      border-color: var(--accent);
    }}
    .table-section {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 14px;
      overflow: hidden;
      backdrop-filter: blur(12px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }}
    .table-wrapper {{
      overflow-x: auto;
      max-height: 65vh;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 0.9rem;
    }}
    th {{
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
    }}
    td {{
      padding: 0.85rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      color: var(--text);
      vertical-align: top;
      max-width: 450px;
      word-break: break-word;
    }}
    tr:hover td {{
      background: var(--table-row-hover);
    }}
    .json-code {{
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      background: rgba(0,0,0,0.4);
      padding: 0.4rem 0.6rem;
      border-radius: 6px;
      display: inline-block;
      max-height: 120px;
      overflow-y: auto;
      color: #93c5fd;
    }}
    .role-badge {{
      display: inline-block;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }}
    .role-user {{ background: rgba(59, 130, 246, 0.2); color: #60a5fa; }}
    .role-assistant {{ background: rgba(168, 85, 247, 0.2); color: #c084fc; }}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-group">
        <h1>Audit-V Live Database Storage</h1>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.35rem;">File: <code>audit_v_users.db</code> (SQLite)</p>
      </div>
      <div class="status-badge">
        <span class="pulse-dot"></span>
        Live SQLite Database
      </div>
    </header>

    <div class="stats-grid" id="statsGrid"></div>

    <div class="controls">
      <h2 id="activeTableTitle" style="font-size: 1.25rem; font-weight: 600;">Table Data</h2>
      <input type="text" id="searchInput" class="search-input" placeholder="Filter rows in current table...">
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
    const data = {data_json};
    const tableNames = Object.keys(data);
    let currentTable = tableNames.includes('users') ? 'users' : tableNames[0];

    function renderStats() {{
      const grid = document.getElementById('statsGrid');
      grid.innerHTML = '';
      tableNames.forEach(t => {{
        const card = document.createElement('div');
        card.className = `stat-card ${{t === currentTable ? 'active' : ''}}`;
        card.innerHTML = `<h3>${{t}}</h3><div class="count">${{data[t].rows.length}}</div>`;
        card.onclick = () => {{
          currentTable = t;
          document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
          card.classList.add('active');
          renderTable();
        }};
        grid.appendChild(card);
      }});
    }}

    function renderTable() {{
      const tData = data[currentTable];
      document.getElementById('activeTableTitle').innerText = `${{currentTable}} (${{tData.rows.length}} rows)`;
      const thead = document.getElementById('tableHead');
      const tbody = document.getElementById('tableBody');
      const query = document.getElementById('searchInput').value.toLowerCase();

      thead.innerHTML = '<tr>' + tData.columns.map(c => `<th>${{c}}</th>`).join('') + '</tr>';
      
      const filtered = tData.rows.filter(row => {{
        if (!query) return true;
        return Object.values(row).some(v => String(v).toLowerCase().includes(query));
      }});

      if (filtered.length === 0) {{
        tbody.innerHTML = `<tr><td colspan="${{tData.columns.length}}" style="text-align:center; padding: 2rem; color: #9ca3af;">No records found.</td></tr>`;
        return;
      }}

      tbody.innerHTML = filtered.map(row => {{
        return '<tr>' + tData.columns.map(c => {{
          let val = row[c];
          if (c === 'role') {{
            return `<td><span class="role-badge role-${{val}}">${{val}}</span></td>`;
          }}
          if (c === 'data' || typeof val === 'object') {{
            return `<td><pre class="json-code">${{JSON.stringify(val, null, 2)}}</pre></td>`;
          }}
          if (c === 'content' && typeof val === 'string' && val.length > 80) {{
            return `<td><div style="max-height: 120px; overflow-y: auto; white-space: pre-wrap;">${{val}}</div></td>`;
          }}
          return `<td>${{val !== null ? val : '<span style="color:#6b7280">null</span>'}}</td>`;
        }}).join('') + '</tr>';
      }}).join('');
    }}

    document.getElementById('searchInput').addEventListener('input', renderTable);
    renderStats();
    renderTable();
  </script>
</body>
</html>
"""
    output_path.write_text(html_content, encoding="utf-8")
    print(f"\n[OK] Interactive Live HTML Dashboard created at: {output_path.resolve()}")


def inspect_db():
    if not DB_PATH.exists():
        print(f"Error: Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [r[0] for r in cursor.fetchall()]

    print("=" * 80)
    print(f"AUDIT-V LIVE DATABASE: {DB_PATH.resolve()}")
    print("=" * 80)

    tables_data = {}

    for table in tables:
        cursor.execute(f"PRAGMA table_info({table});")
        columns = [c[1] for c in cursor.fetchall()]

        cursor.execute(f"SELECT * FROM {table};")
        rows = [dict(r) for r in cursor.fetchall()]

        processed_rows = []
        for row in rows:
            display_row = dict(row)
            if "hashed_password" in display_row and display_row["hashed_password"]:
                display_row["hashed_password"] = display_row["hashed_password"][:12] + "..."
            for k, v in display_row.items():
                if isinstance(v, str) and (v.startswith("{") or v.startswith("[")):
                    try:
                        display_row[k] = json.loads(v)
                    except Exception:
                        pass
            processed_rows.append(display_row)

        tables_data[table] = {"columns": columns, "rows": processed_rows}

        print(f"\nTABLE: [{table}] -> Total Records: {len(rows)}")
        print(f"Columns: {', '.join(columns)}")
        print("-" * 80)

        if not rows:
            print("  (No records)")
            continue

        for i, row in enumerate(processed_rows, 1):
            print(f"  [{i}] {json.dumps(row, default=str)}")

    # Generate HTML viewer
def watch_db(interval_sec: float = 2.0):
    """Continuously poll SQLite and print newly inserted rows in real-time in the terminal."""
    import time
    print("=" * 80)
    print(f"LIVE TERMINAL DB MONITOR (Watching {DB_PATH.name} every {interval_sec}s)")
    print("Press Ctrl+C to stop.")
    print("=" * 80)

    last_counts = {}
    last_ids = {}

    while True:
        try:
            conn = sqlite3.connect(f"file:{DB_PATH.resolve()}?mode=ro", uri=True)
        except Exception:
            conn = sqlite3.connect(DB_PATH)

        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
        tables = [r[0] for r in cur.fetchall()]

        for table in tables:
            cur.execute(f"PRAGMA table_info({table});")
            cols = [c[1] for c in cur.fetchall()]
            has_id = "id" in cols

            if has_id:
                cur.execute(f"SELECT * FROM {table} ORDER BY id DESC LIMIT 1;")
                latest = cur.fetchone()
                if latest:
                    latest_id = latest["id"]
                    if table in last_ids and latest_id > last_ids[table]:
                        # Fetch all new rows since last check
                        cur.execute(f"SELECT * FROM {table} WHERE id > ? ORDER BY id ASC;", (last_ids[table],))
                        new_rows = cur.fetchall()
                        for nr in new_rows:
                            d = dict(nr)
                            if "hashed_password" in d and d["hashed_password"]:
                                d["hashed_password"] = d["hashed_password"][:12] + "..."
                            print(f"\n[NEW RECORD] in [{table}] -> {json.dumps(d, default=str)}")
                    last_ids[table] = latest_id
            else:
                cur.execute(f"SELECT COUNT(*) FROM {table};")
                count = cur.fetchone()[0]
                if table in last_counts and count > last_counts[table]:
                    print(f"\n[TABLE UPDATED] [{table}] count changed: {last_counts[table]} -> {count}")
                last_counts[table] = count

        conn.close()
        time.sleep(interval_sec)


if __name__ == "__main__":
    import sys
    if "--watch" in sys.argv or "-w" in sys.argv:
        watch_db()
    else:
        inspect_db()

