import GLib from "gi://GLib";
import Gdk from "gi://Gdk?version=4.0";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";
import GtkSource from "gi://GtkSource?version=5";

export type RequestBodyPanel = {
  widget: Gtk.Widget;
  getSendOptions: () => {
    body?: string;
    contentType?: string;
    queryParams?: Array<{ key: string; value: string }>;
    headers?: Array<{ key: string; value: string }>;
  };
};

type RequestBodyPanelOptions = {
  onQueryParamsChanged?: (params: Array<{ key: string; value: string }>) => void;
};

export default function createRequestBodyPanel(options: RequestBodyPanelOptions = {}): RequestBodyPanel {
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
    hexpand: true,
    vexpand: true,
    margin_top: 6,
    margin_bottom: 6,
    margin_start: 6,
    margin_end: 6,
  });

  let updatingMode = false;
  let mode: "raw" | "json" = "raw";

  const rawLabel = new Gtk.Label({ label: "Raw" });
  rawLabel.css_classes = ["dim-label"];
  const modeSwitch = new Gtk.Switch({ active: false });

  const modeSwitchBox = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 6,
    halign: Gtk.Align.START,
    valign: Gtk.Align.CENTER,
    margin_start: 8,
    margin_end: 8,
    margin_bottom: 6,
  });
  modeSwitchBox.append(rawLabel);
  modeSwitchBox.append(modeSwitch);

  const notebook = new Gtk.Notebook({
    hexpand: true,
    vexpand: true,
  });
  try {
    notebook.show_border = false;
  } catch {
  }
  root.append(notebook);

  const languageManager = (GtkSource as any).LanguageManager?.get_default?.();
  const jsonLanguage = languageManager ? languageManager.get_language?.("json") : null;

  const schemeManager = (GtkSource as any).StyleSchemeManager?.get_default?.();
  const getScheme = (candidates: string[]) => {
    for (const id of candidates) {
      try {
        const s = schemeManager?.get_scheme?.(id);
        if (s) return s;
      } catch {
      }
    }
    return null;
  };

  const buffer = new (GtkSource as any).Buffer();
  try {
    (buffer as any).highlight_syntax = false;
    (buffer as any).highlight_matching_brackets = true;
  } catch {
  }
  const adwStyleManager = Adw.StyleManager.get_default();
  const applyThemeToBuffer = () => {
    try {
      const dark = Boolean((adwStyleManager as any).dark);
      const scheme = dark
        ? getScheme(["Adwaita-dark", "adwaita-dark", "oblivion", "cobalt", "kate"])
        : getScheme(["Adwaita", "adwaita", "classic", "tango"]);
      (buffer as any).style_scheme = scheme;
    } catch {
    }
  };
  applyThemeToBuffer();
  try {
    adwStyleManager.connect("notify::dark", applyThemeToBuffer);
  } catch {
  }

  const view = new (GtkSource as any).View({
    buffer,
    editable: true,
    monospace: true,
    wrap_mode: Gtk.WrapMode.WORD_CHAR,
    hexpand: true,
    vexpand: true,
    left_margin: 12,
    right_margin: 12,
    top_margin: 12,
    bottom_margin: 12,
  });
  try {
    (view as any).show_line_numbers = true;
    (view as any).tab_width = 2;
    (view as any).indent_width = 2;
    (view as any).insert_spaces_instead_of_tabs = true;
    (view as any).auto_indent = true;
    (view as any).show_right_margin = false;
    (view as any).overwrite = false;
  } catch {
  }

  const keyController = new Gtk.EventControllerKey();
  keyController.connect("key-pressed", (_c: any, keyval: number, _keycode: number, state: number) => {
    if (keyval === (Gdk as any).KEY_Tab && !(state & (Gdk as any).ModifierType.SHIFT_MASK)) {
      const anyBuffer = buffer as any;

      // If there is a selection, let GtkSourceView handle indentation.
      try {
        const sel = anyBuffer.get_selection_bounds?.();
        if (sel && sel[0]) return false;
      } catch {
      }

      const insertMark = buffer.get_insert();
      const iter = anyBuffer.get_iter_at_mark(insertMark);

      if (mode === "json") {
        try {
          const wordEnd = iter.copy();
          const wordStart = iter.copy();

          // Walk backwards to find an identifier token directly before the cursor.
          while (true) {
            const prev = wordStart.copy();
            if (!prev.backward_char?.()) break;
            const ch = String(prev.get_char?.() ?? "");
            if (!/^[A-Za-z0-9_]$/.test(ch)) break;
            wordStart.backward_char?.();
          }

          // If we didn't move, there is no token.
          if (wordStart.equal?.(wordEnd)) return false;

          const token = String(anyBuffer.get_text(wordStart, wordEnd, true) ?? "");
          if (!token || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) return false;

          // If it's already quoted, don't touch.
          const before = wordStart.copy();
          if (before.backward_char?.()) {
            const bch = String(before.get_char?.() ?? "");
            if (bch === '"') return false;
          }

          // If ':' is already next, don't transform.
          const after = wordEnd.copy();
          const ach = String(after.get_char?.() ?? "");
          if (ach === ":") return false;

          buffer.delete(wordStart, wordEnd);
          buffer.insert(wordStart, `"${token}": `, -1);
          return true;
        } catch {
          // fall through
        }
      }

      // Let GtkSourceView insert spaces (tab_width=2) / indent normally.
      return false;
    }

    return false;
  });
  view.add_controller(keyController);

  const scrolled = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: true,
  });
  scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

  scrolled.set_child(view);

  const bodyPage = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
    hexpand: true,
    vexpand: true,
  });
  bodyPage.append(scrolled);
  bodyPage.append(modeSwitchBox);
  notebook.append_page(bodyPage, new Gtk.Label({ label: "Body" }));

  const createKeyValueEditorPage = (opts: {
    tabLabel: string;
    addLabel: string;
    keyPlaceholder: string;
    valuePlaceholder: string;
    onChanged?: (pairs: Array<{ key: string; value: string }>) => void;
  }) => {
    const list = new Gtk.ListBox();
    list.selection_mode = Gtk.SelectionMode.NONE;

    const sc = new Gtk.ScrolledWindow({
      hexpand: true,
      vexpand: true,
    });
    sc.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
    sc.set_child(list);

    const getPairs = () => {
      const pairs: Array<{ key: string; value: string }> = [];
      let child: any = list.get_first_child();
      while (child) {
        const row: any = child;
        const kEntry: any = row._keyEntry;
        const vEntry: any = row._valueEntry;
        const key = kEntry?.get_text ? String(kEntry.get_text() ?? "") : String(kEntry?.text ?? "");
        const value = vEntry?.get_text ? String(vEntry.get_text() ?? "") : String(vEntry?.text ?? "");
        if (key.trim()) pairs.push({ key: key.trim(), value: String(value ?? "") });
        child = child.get_next_sibling?.() ?? null;
      }
      return pairs;
    };

    const notifyChanged = () => {
      try {
        opts.onChanged?.(getPairs());
      } catch {
      }
    };

    const addRow = () => {
      const row = new Gtk.ListBoxRow();
      row.selectable = false;
      row.activatable = false;

      const rowBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 6,
        margin_top: 8,
        margin_bottom: 8,
        margin_start: 8,
        margin_end: 8,
      });

      const keyEntry = new Gtk.Entry({
        placeholder_text: opts.keyPlaceholder,
      });
      keyEntry.hexpand = true;

      const valueEntry = new Gtk.Entry({
        placeholder_text: opts.valuePlaceholder,
      });
      valueEntry.hexpand = true;

      const removeBtn = new Gtk.Button({
        css_classes: ["flat"],
        icon_name: "window-close-symbolic",
      });
      removeBtn.valign = Gtk.Align.CENTER;
      removeBtn.connect("clicked", () => {
        try {
          list.remove(row);
        } catch {
        }
        notifyChanged();
      });

      (row as any)._keyEntry = keyEntry;
      (row as any)._valueEntry = valueEntry;

      keyEntry.connect("changed", notifyChanged);
      valueEntry.connect("changed", notifyChanged);

      rowBox.append(keyEntry);
      rowBox.append(valueEntry);
      rowBox.append(removeBtn);
      row.set_child(rowBox);
      list.append(row);

      notifyChanged();
    };

    const addBtn = new Gtk.Button({
      label: opts.addLabel,
    });
    addBtn.css_classes = ["flat"];
    addBtn.halign = Gtk.Align.START;
    addBtn.connect("clicked", addRow);

    const page = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 6,
      hexpand: true,
      vexpand: true,
    });
    page.append(sc);
    page.append(addBtn);

    addRow();

    notebook.append_page(page, new Gtk.Label({ label: opts.tabLabel }));

    return { getPairs };
  };

  const queryEditor = createKeyValueEditorPage({
    tabLabel: "Query",
    addLabel: "Add Query Param",
    keyPlaceholder: "Key",
    valuePlaceholder: "Value",
    onChanged: options.onQueryParamsChanged,
  });

  const headerEditor = createKeyValueEditorPage({
    tabLabel: "Header",
    addLabel: "Add Header",
    keyPlaceholder: "Header",
    valuePlaceholder: "Value",
  });

  const getText = () => {
    const anyBuffer = buffer as any;
    const start = buffer.get_start_iter();
    const end = buffer.get_end_iter();
    return typeof anyBuffer.get_text === "function" ? anyBuffer.get_text(start, end, true) : "";
  };

  const setMode = (next: "raw" | "json") => {
    updatingMode = true;
    mode = next;
    modeSwitch.active = next === "raw";
    updatingMode = false;

    try {
      if (mode === "json") {
        (buffer as any).language = jsonLanguage;
        (buffer as any).highlight_syntax = true;
      } else {
        (buffer as any).language = null;
        (buffer as any).highlight_syntax = false;
      }
    } catch {
    }
  };

  modeSwitch.connect("notify::active", () => {
    if (updatingMode) return;
    setMode(modeSwitch.active ? "raw" : "json");
  });

  setMode("json");

  return {
    widget: root,
    getSendOptions: () => {
      const body = String(getText() ?? "");
      const opts: {
        body?: string;
        contentType?: string;
        queryParams?: Array<{ key: string; value: string }>;
        headers?: Array<{ key: string; value: string }>;
      } = {};

      if (body.trim()) {
        opts.body = body;
        if (mode === "json") opts.contentType = "application/json";
      }

      opts.queryParams = queryEditor.getPairs();
      opts.headers = headerEditor.getPairs();

      return opts;
    },
  } satisfies RequestBodyPanel;
}
