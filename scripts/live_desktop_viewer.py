"""Native Windows Live Database Monitor for Audit-V.
Opens a standalone desktop GUI window that auto-refreshes every 1 second
directly from audit_v_users.db without needing any browser or web server.
"""
from __future__ import annotations

import json
import sqlite3
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import ttk

DB_PATH = Path(__file__).resolve().parents[1] / "audit_v_users.db"


class LiveDatabaseApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Audit-V — Real-Time Live Database Monitor")
        self.root.geometry("1100x680")
        self.root.minsize(800, 500)

        # Apply dark theme styling
        self.bg_color = "#0b0f19"
        self.card_color = "#131b2e"
        self.accent_color = "#3b82f6"
        self.text_color = "#f3f4f6"
        self.text_muted = "#9ca3af"

        self.root.configure(bg=self.bg_color)

        self.current_table = "user_chat_messages"
        self.last_counts = {}
        self.cached_data = {}

        self._setup_styles()
        self._build_ui()
        self.poll_db()

    def _setup_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        # Configure Treeview styling
        style.configure(
            "Treeview",
            background="#111827",
            foreground="#f3f4f6",
            fieldbackground="#111827",
            rowheight=32,
            font=("Segoe UI", 10),
            borderwidth=0,
        )
        style.configure(
            "Treeview.Heading",
            background="#1f2937",
            foreground="#93c5fd",
            font=("Segoe UI", 10, "bold"),
            borderwidth=1,
            relief="flat",
        )
        style.map("Treeview", background=[("selected", "#2563eb")], foreground=[("selected", "#ffffff")])
        style.map("Treeview.Heading", background=[("active", "#374151")])

    def _build_ui(self):
        # Header bar
        header_frame = tk.Frame(self.root, bg=self.card_color, padx=20, pady=14)
        header_frame.pack(fill=tk.X, side=tk.TOP)

        title_label = tk.Label(
            header_frame,
            text="Audit-V Live Database Monitor",
            font=("Segoe UI", 15, "bold"),
            bg=self.card_color,
            fg="#60a5fa",
        )
        title_label.pack(side=tk.LEFT)

        self.status_label = tk.Label(
            header_frame,
            text="🟢 LIVE & AUTO-UPDATING (1s)",
            font=("Segoe UI", 10, "bold"),
            bg="#064e3b",
            fg="#34d399",
            padx=12,
            pady=4,
        )
        self.status_label.pack(side=tk.RIGHT)

        # Tab button bar for tables
        self.tabs_frame = tk.Frame(self.root, bg=self.bg_color, padx=16, pady=10)
        self.tabs_frame.pack(fill=tk.X, side=tk.TOP)

        # Search bar & active info bar
        controls_frame = tk.Frame(self.root, bg=self.bg_color, padx=16, pady=4)
        controls_frame.pack(fill=tk.X, side=tk.TOP)

        self.table_title_var = tk.StringVar(value="Table: user_chat_messages")
        lbl_info = tk.Label(
            controls_frame,
            textvariable=self.table_title_var,
            font=("Segoe UI", 12, "bold"),
            bg=self.bg_color,
            fg=self.text_color,
        )
        lbl_info.pack(side=tk.LEFT)

        # Search input
        search_box_frame = tk.Frame(controls_frame, bg=self.bg_color)
        search_box_frame.pack(side=tk.RIGHT)

        tk.Label(search_box_frame, text="Filter:", font=("Segoe UI", 10), bg=self.bg_color, fg=self.text_muted).pack(
            side=tk.LEFT, padx=4
        )
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", lambda *args: self._render_current_table())
        search_entry = tk.Entry(
            search_box_frame,
            textvariable=self.search_var,
            font=("Segoe UI", 10),
            bg="#1f2937",
            fg="#ffffff",
            insertbackground="#ffffff",
            relief="flat",
            width=24,
        )
        search_entry.pack(side=tk.LEFT, ipady=3)

        # Table Treeview frame
        tree_frame = tk.Frame(self.root, bg=self.bg_color, padx=16, pady=8)
        tree_frame.pack(fill=tk.BOTH, expand=True)

        self.tree = ttk.Treeview(tree_frame, selectmode="browse", show="headings")
        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        hsb = ttk.Scrollbar(tree_frame, orient="horizontal", command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)

        self.tree.grid(row=0, column=0, sticky="nsew")
        vsb.grid(row=0, column=1, sticky="ns")
        hsb.grid(row=1, column=0, sticky="ew")

        tree_frame.grid_rowconfigure(0, weight=1)
        tree_frame.grid_columnconfigure(0, weight=1)

        # Bottom status bar
        self.bottom_bar = tk.Label(
            self.root,
            text=f"Database: {DB_PATH.resolve()}",
            font=("Segoe UI", 9),
            bg=self.card_color,
            fg=self.text_muted,
            anchor="w",
            padx=16,
            pady=6,
        )
        self.bottom_bar.pack(fill=tk.X, side=tk.BOTTOM)

    def _switch_table(self, table_name: str):
        self.current_table = table_name
        self._update_tab_buttons()
        self._render_current_table()

    def _update_tab_buttons(self):
        for widget in self.tabs_frame.winfo_children():
            widget.destroy()

        for t, val in self.cached_data.items():
            count = len(val["rows"])
            is_active = t == self.current_table
            btn_bg = "#2563eb" if is_active else "#1f2937"
            btn_fg = "#ffffff" if is_active else "#d1d5db"

            btn = tk.Button(
                self.tabs_frame,
                text=f"{t} ({count})",
                font=("Segoe UI", 10, "bold" if is_active else "normal"),
                bg=btn_bg,
                fg=btn_fg,
                activebackground="#1d4ed8",
                activeforeground="#ffffff",
                relief="flat",
                padx=12,
                pady=6,
                cursor="hand2",
                command=lambda name=t: self._switch_table(name),
            )
            btn.pack(side=tk.LEFT, padx=4)

    def _render_current_table(self):
        if self.current_table not in self.cached_data:
            return

        t_data = self.cached_data[self.current_table]
        columns = t_data["columns"]
        rows = t_data["rows"]

        self.table_title_var.set(f"{self.current_table} ({len(rows)} records, newest on top)")

        # Configure columns
        self.tree["columns"] = columns
        for c in columns:
            width = 100
            if c in ("content", "notes", "data"):
                width = 380
            elif c in ("email", "timestamp", "created_at", "updated_at"):
                width = 180
            elif c in ("username", "full_name", "category", "filename"):
                width = 140
            self.tree.heading(c, text=c.upper())
            self.tree.column(c, width=width, anchor="w")

        # Clear existing rows
        for item in self.tree.get_children():
            self.tree.delete(item)

        filter_q = self.search_var.get().lower().strip()

        for r in rows:
            values = []
            for c in columns:
                v = r.get(c, "")
                if isinstance(v, (dict, list)):
                    v = json.dumps(v)
                elif v is None:
                    v = "null"
                values.append(str(v))

            if filter_q:
                match = any(filter_q in str(val).lower() for val in values)
                if not match:
                    continue

            self.tree.insert("", tk.END, values=values)

    def poll_db(self):
        """Polls SQLite every 1000ms. If data changes, immediately updates UI."""
        if DB_PATH.exists():
            try:
                try:
                    conn = sqlite3.connect(f"file:{DB_PATH.resolve()}?mode=ro", uri=True)
                except Exception:
                    conn = sqlite3.connect(DB_PATH)

                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
                tables = [r[0] for r in cur.fetchall()]

                has_changes = False
                new_cached = {}

                for table in tables:
                    cur.execute(f"PRAGMA table_info({table});")
                    columns = [c[1] for c in cur.fetchall()]
                    order_clause = "ORDER BY id DESC" if "id" in columns else ""
                    cur.execute(f"SELECT * FROM {table} {order_clause};")
                    rows = [dict(r) for r in cur.fetchall()]

                    # Mask passwords
                    for row in rows:
                        if "hashed_password" in row and row["hashed_password"]:
                            row["hashed_password"] = row["hashed_password"][:12] + "..."

                    new_cached[table] = {"columns": columns, "rows": rows}

                    old_len = self.last_counts.get(table, -1)
                    if old_len != len(rows):
                        has_changes = True
                    self.last_counts[table] = len(rows)

                conn.close()

                if has_changes or not self.cached_data:
                    self.cached_data = new_cached
                    self._update_tab_buttons()
                    self._render_current_table()

                now = datetime.now().strftime("%H:%M:%S")
                summary_parts = [f"{t} ({len(v['rows'])})" for t, v in self.cached_data.items()]
                summary_str = ", ".join(summary_parts)
                self.bottom_bar.config(
                    text=f"Live Synced: {now} | Database: {DB_PATH.name} | Watching: {summary_str}"
                )

            except Exception as e:
                self.bottom_bar.config(text=f"Read warning: {e}")

        # Schedule next check in 1000 milliseconds (1 second)
        self.root.after(1000, self.poll_db)


def main():
    root = tk.Tk()
    app = LiveDatabaseApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
