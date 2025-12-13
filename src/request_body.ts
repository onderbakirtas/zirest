import GLib from "gi://GLib";
import Gdk from "gi://Gdk?version=4.0";
import Gtk from "gi://Gtk?version=4.0";
import GtkSource from "gi://GtkSource?version=5";

export type RequestBodyPanel = {
  widget: Gtk.Widget;
  getSendOptions: () => { body?: string; contentType?: string };
};

export default function createRequestBodyPanel(): RequestBodyPanel {
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

  const headerRow = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 6,
    halign: Gtk.Align.FILL,
  });
  headerRow.hexpand = true;

  const title = new Gtk.Label({ label: "Request Body", xalign: 0 });
  title.hexpand = true;

  let updatingMode = false;
  let mode: "raw" | "json" = "raw";

  const rawBtn = new Gtk.ToggleButton({ label: "Raw" });
  const jsonBtn = new Gtk.ToggleButton({ label: "JSON" });

  const modeButtons = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 0,
    css_classes: ["linked"],
  });
  modeButtons.append(rawBtn);
  modeButtons.append(jsonBtn);

  headerRow.append(title);
  headerRow.append(modeButtons);
  root.append(headerRow);

  const languageManager = (GtkSource as any).LanguageManager?.get_default?.();
  const jsonLanguage = languageManager ? languageManager.get_language?.("json") : null;

  const buffer = new (GtkSource as any).Buffer();
  try {
    (buffer as any).highlight_syntax = false;
    (buffer as any).highlight_matching_brackets = true;
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

  root.append(scrolled);

  const getText = () => {
    const anyBuffer = buffer as any;
    const start = buffer.get_start_iter();
    const end = buffer.get_end_iter();
    return typeof anyBuffer.get_text === "function" ? anyBuffer.get_text(start, end, true) : "";
  };

  const setMode = (next: "raw" | "json") => {
    updatingMode = true;
    mode = next;
    rawBtn.active = next === "raw";
    jsonBtn.active = next === "json";
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

  rawBtn.connect("toggled", () => {
    if (updatingMode) return;
    if (rawBtn.active) setMode("raw");
    else rawBtn.active = true;
  });
  jsonBtn.connect("toggled", () => {
    if (updatingMode) return;
    if (jsonBtn.active) setMode("json");
    else jsonBtn.active = true;
  });

  setMode("raw");

  return {
    widget: root,
    getSendOptions: () => {
      const body = String(getText() ?? "");
      if (!body.trim()) return {};
      if (mode === "json") return { body, contentType: "application/json" };
      return { body };
    },
  } satisfies RequestBodyPanel;
}
