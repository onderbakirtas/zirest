import GLib from "gi://GLib";
import Gdk from "gi://Gdk?version=4.0";
import Gtk from "gi://Gtk?version=4.0";

export type RequestBodyPanel = {
  widget: Gtk.Widget;
  getSendOptions: () => { body?: string; contentType?: string };
};

const COLORS = {
  punctuation: "#D4D4D4",
  key: "#9CDCFE",
  string: "#CE9178",
  number: "#B5CEA8",
  boolean: "#569CD6",
  null: "#569CD6",
} as const;

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

  const buffer = new Gtk.TextBuffer();
  const tagTable = buffer.get_tag_table();

  const tagPunctuation = new Gtk.TextTag({ name: "punctuation", foreground: COLORS.punctuation });
  const tagKey = new Gtk.TextTag({ name: "key", foreground: COLORS.key });
  const tagString = new Gtk.TextTag({ name: "string", foreground: COLORS.string });
  const tagNumber = new Gtk.TextTag({ name: "number", foreground: COLORS.number });
  const tagBoolean = new Gtk.TextTag({ name: "boolean", foreground: COLORS.boolean });
  const tagNull = new Gtk.TextTag({ name: "null", foreground: COLORS.null });

  tagTable.add(tagPunctuation);
  tagTable.add(tagKey);
  tagTable.add(tagString);
  tagTable.add(tagNumber);
  tagTable.add(tagBoolean);
  tagTable.add(tagNull);

  const view = new Gtk.TextView({
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

  const keyController = new Gtk.EventControllerKey();
  keyController.connect("key-pressed", (_c: any, keyval: number, _keycode: number, state: number) => {
    if (keyval === (Gdk as any).KEY_Tab && !(state & (Gdk as any).ModifierType.SHIFT_MASK)) {
      const anyBuffer = buffer as any;

      try {
        const sel = anyBuffer.get_selection_bounds?.();
        if (sel && sel[0]) {
          // Keep it simple: if there is a selection, don't try to transform it.
          const selStart = sel[1];
          buffer.delete(selStart, sel[2]);
          buffer.insert(selStart, "  ", -1);
          return true;
        }
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
          if (wordStart.equal?.(wordEnd)) {
            buffer.insert(iter, "  ", -1);
            return true;
          }

          const token = String(anyBuffer.get_text(wordStart, wordEnd, true) ?? "");
          if (!token || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(token)) {
            buffer.insert(iter, "  ", -1);
            return true;
          }

          // If it's already quoted, don't touch.
          const before = wordStart.copy();
          if (before.backward_char?.()) {
            const bch = String(before.get_char?.() ?? "");
            if (bch === '"') {
              buffer.insert(iter, "  ", -1);
              return true;
            }
          }

          // If ':' is already next, don't transform.
          const after = wordEnd.copy();
          const ach = String(after.get_char?.() ?? "");
          if (ach === ":") {
            buffer.insert(iter, "  ", -1);
            return true;
          }

          buffer.delete(wordStart, wordEnd);
          buffer.insert(wordStart, `"${token}": `, -1);
          return true;
        } catch {
          // fall through
        }
      }

      buffer.insert(iter, "  ", -1);
      return true;
    }

    if (
      keyval === (Gdk as any).KEY_Return ||
      keyval === (Gdk as any).KEY_KP_Enter ||
      keyval === (Gdk as any).KEY_ISO_Enter
    ) {
      const anyBuffer = buffer as any;

      let insertIter: any;
      try {
        const sel = anyBuffer.get_selection_bounds?.();
        if (sel && sel[0]) {
          const selStart = sel[1];
          const selEnd = sel[2];
          buffer.delete(selStart, selEnd);
          insertIter = selStart;
        }
      } catch {
      }

      if (!insertIter) {
        const insertMark = buffer.get_insert();
        insertIter = anyBuffer.get_iter_at_mark(insertMark);
      }

      const lineStart = insertIter.copy();
      try {
        lineStart.set_line_offset(0);
      } catch {
      }

      const indentEnd = lineStart.copy();
      while (true) {
        let ch = "";
        try {
          ch = String(indentEnd.get_char?.() ?? "");
        } catch {
          ch = "";
        }

        const atLineEnd = (() => {
          try {
            return Boolean(indentEnd.ends_line?.());
          } catch {
            return false;
          }
        })();

        if (atLineEnd) break;
        if (ch !== " " && ch !== "\t") break;

        try {
          indentEnd.forward_char();
        } catch {
          break;
        }
      }

      let indent = "";
      try {
        indent = String(anyBuffer.get_text(lineStart, indentEnd, true) ?? "");
      } catch {
        indent = "";
      }

      buffer.insert(insertIter, "\n" + indent, -1);
      return true;
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

  const clearTags = () => {
    const fullStart = buffer.get_start_iter();
    const fullEnd = buffer.get_end_iter();
    try {
      (buffer as any).remove_all_tags(fullStart, fullEnd);
    } catch {
    }
  };

  const iterAt = (offset: number) => (buffer as any).get_iter_at_offset(offset);

  const applyJsonHighlight = (text: string) => {
    clearTags();

    const stringRanges: Array<{ start: number; end: number }> = [];
    const reString = /\"(?:\\.|[^\"\\])*\"/g;
    for (let m = reString.exec(text); m; m = reString.exec(text)) {
      stringRanges.push({ start: m.index, end: m.index + m[0].length });
    }

    const inString = (pos: number) => {
      for (const r of stringRanges) {
        if (pos >= r.start && pos < r.end) return true;
      }
      return false;
    };

    for (const r of stringRanges) {
      const after = text.slice(r.end);
      const isKey = /^\s*:/.test(after);
      buffer.apply_tag(isKey ? tagKey : tagString, iterAt(r.start), iterAt(r.end));
    }

    const reNumber = /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
    for (let m = reNumber.exec(text); m; m = reNumber.exec(text)) {
      if (inString(m.index)) continue;
      buffer.apply_tag(tagNumber, iterAt(m.index), iterAt(m.index + m[0].length));
    }

    const reBool = /\btrue\b|\bfalse\b/g;
    for (let m = reBool.exec(text); m; m = reBool.exec(text)) {
      if (inString(m.index)) continue;
      buffer.apply_tag(tagBoolean, iterAt(m.index), iterAt(m.index + m[0].length));
    }

    const reNull = /\bnull\b/g;
    for (let m = reNull.exec(text); m; m = reNull.exec(text)) {
      if (inString(m.index)) continue;
      buffer.apply_tag(tagNull, iterAt(m.index), iterAt(m.index + m[0].length));
    }

    for (let i = 0; i < text.length; i++) {
      if (inString(i)) continue;
      const ch = text[i];
      if (ch === "{" || ch === "}" || ch === "[" || ch === "]" || ch === ":" || ch === ",") {
        buffer.apply_tag(tagPunctuation, iterAt(i), iterAt(i + 1));
      }
    }
  };

  const getText = () => {
    const anyBuffer = buffer as any;
    const start = buffer.get_start_iter();
    const end = buffer.get_end_iter();
    return typeof anyBuffer.get_text === "function" ? anyBuffer.get_text(start, end, true) : "";
  };

  const rehighlight = () => {
    if (mode !== "json") {
      clearTags();
      return;
    }
    applyJsonHighlight(String(getText() ?? ""));
  };

  buffer.connect("changed", () => {
    if (mode !== "json") return;
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
      rehighlight();
      return GLib.SOURCE_REMOVE;
    });
  });

  const setMode = (next: "raw" | "json") => {
    updatingMode = true;
    mode = next;
    rawBtn.active = next === "raw";
    jsonBtn.active = next === "json";
    updatingMode = false;
    rehighlight();
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
      return { body, contentType: "text/plain" };
    },
  } satisfies RequestBodyPanel;
}
