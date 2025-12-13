import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";

type ResponsePage = {
  widget: Gtk.Widget;
  setText: (text: string) => void;
  setJson: (value: unknown) => void;
  setError: (message: string) => void;
  setHeaders: (headers: Record<string, string>) => void;
  setMeta: (meta: {
    status: number | string;
    statusText?: string;
    durationMs?: number;
    sizeBytes?: number;
  }) => void;
};

const COLORS = {
  punctuation: "#D4D4D4",
  key: "#9CDCFE",
  string: "#CE9178",
  number: "#B5CEA8",
  boolean: "#569CD6",
  null: "#569CD6",
  error: "#F44747",
} as const;

const esc = (s: string) => GLib.markup_escape_text(s, -1);

const span = (text: string, color: string) => {
  return `<span font_family="monospace" foreground="${color}">${esc(text)}</span>`;
};

export default function createResponsePage(): ResponsePage {
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
    hexpand: true,
    vexpand: true,
  });

  const bodyBuffer = new Gtk.TextBuffer();
  const bodyTagTable = bodyBuffer.get_tag_table();
  const tagPunctuation = new Gtk.TextTag({ name: "punctuation", foreground: COLORS.punctuation });
  const tagKey = new Gtk.TextTag({ name: "key", foreground: COLORS.key });
  const tagString = new Gtk.TextTag({ name: "string", foreground: COLORS.string });
  const tagNumber = new Gtk.TextTag({ name: "number", foreground: COLORS.number });
  const tagBoolean = new Gtk.TextTag({ name: "boolean", foreground: COLORS.boolean });
  const tagNull = new Gtk.TextTag({ name: "null", foreground: COLORS.null });
  bodyTagTable.add(tagPunctuation);
  bodyTagTable.add(tagKey);
  bodyTagTable.add(tagString);
  bodyTagTable.add(tagNumber);
  bodyTagTable.add(tagBoolean);
  bodyTagTable.add(tagNull);

  const bodyView = new Gtk.TextView({
    buffer: bodyBuffer,
    editable: false,
    monospace: true,
    wrap_mode: Gtk.WrapMode.WORD_CHAR,
    hexpand: true,
    vexpand: true,
    left_margin: 12,
    right_margin: 12,
    top_margin: 12,
    bottom_margin: 12,
  });
  const bodyScrolled = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: true,
  });
  bodyScrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
  bodyScrolled.set_child(bodyView);

  const headersBuffer = new Gtk.TextBuffer();

  const headersList = new Gtk.ListBox({
    css_classes: ["boxed-list"],
  });
  headersList.selection_mode = Gtk.SelectionMode.NONE;

  const headersScrolled = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: true,
  });
  headersScrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
  headersScrolled.set_child(headersList);

  const viewStack = new Adw.ViewStack();
  viewStack.hexpand = true;
  viewStack.vexpand = true;
  viewStack.add_titled(bodyScrolled, "body", "Body");
  viewStack.add_titled(headersScrolled, "headers", "Headers");
  viewStack.visible_child_name = "body";

  try {
    const bodyPage = (viewStack as any).get_page?.(bodyScrolled);
    const headersPage = (viewStack as any).get_page?.(headersScrolled);
    if (bodyPage) bodyPage.icon_name = null;
    if (headersPage) headersPage.icon_name = null;
  } catch {
  }

  const switcher = new Adw.ViewSwitcher({ stack: viewStack });

  const statusLine = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 10,
    halign: Gtk.Align.END,
  });

  const statusLabel = new Gtk.Label({ xalign: 0, use_markup: true, label: "" });
  const durationLabel = new Gtk.Label({ xalign: 0, label: "" });
  durationLabel.css_classes = ["dim-label"];
  const sizeLabel = new Gtk.Label({ xalign: 0, label: "" });
  sizeLabel.css_classes = ["dim-label"];

  statusLine.append(statusLabel);
  statusLine.append(durationLabel);
  statusLine.append(sizeLabel);

  const tabRow = new Gtk.CenterBox({
    orientation: Gtk.Orientation.HORIZONTAL,
    margin_top: 6,
    margin_bottom: 6,
  });
  tabRow.set_start_widget(switcher);
  tabRow.set_end_widget(statusLine);

  root.append(tabRow);
  root.append(viewStack);

  const applyJsonHighlight = (text: string) => {
    bodyBuffer.set_text(text, -1);

    const fullStart = bodyBuffer.get_start_iter();
    const fullEnd = bodyBuffer.get_end_iter();
    try {
      (bodyBuffer as any).remove_all_tags(fullStart, fullEnd);
    } catch {
    }

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

    const iterAt = (offset: number) => (bodyBuffer as any).get_iter_at_offset(offset);

    for (const r of stringRanges) {
      const after = text.slice(r.end);
      const isKey = /^\s*:/.test(after);
      bodyBuffer.apply_tag(isKey ? tagKey : tagString, iterAt(r.start), iterAt(r.end));
    }

    const reNumber = /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
    for (let m = reNumber.exec(text); m; m = reNumber.exec(text)) {
      if (inString(m.index)) continue;
      bodyBuffer.apply_tag(tagNumber, iterAt(m.index), iterAt(m.index + m[0].length));
    }

    const reBool = /\btrue\b|\bfalse\b/g;
    for (let m = reBool.exec(text); m; m = reBool.exec(text)) {
      if (inString(m.index)) continue;
      bodyBuffer.apply_tag(tagBoolean, iterAt(m.index), iterAt(m.index + m[0].length));
    }

    const reNull = /\bnull\b/g;
    for (let m = reNull.exec(text); m; m = reNull.exec(text)) {
      if (inString(m.index)) continue;
      bodyBuffer.apply_tag(tagNull, iterAt(m.index), iterAt(m.index + m[0].length));
    }

    for (let i = 0; i < text.length; i++) {
      if (inString(i)) continue;
      const ch = text[i];
      if (ch === "{" || ch === "}" || ch === "[" || ch === "]" || ch === ":" || ch === ",") {
        bodyBuffer.apply_tag(tagPunctuation, iterAt(i), iterAt(i + 1));
      }
    }
  };

  const setMeta = (meta: {
    status: number | string;
    statusText?: string;
    durationMs?: number;
    sizeBytes?: number;
  }) => {
    const codeStr = String(meta.status);
    const c = typeof meta.status === "number" ? meta.status : Number(meta.status);
    let color = "#D4D4D4";
    if (!Number.isNaN(c)) {
      if (c >= 200 && c < 300) color = "#6A9955";
      else if (c >= 300 && c < 400) color = "#569CD6";
      else if (c >= 400 && c < 500) color = "#F44747";
      else if (c >= 500 && c < 600) color = "#C586C0";
    }
    const t = meta.statusText ? `HTTP ${codeStr} ${meta.statusText}` : `HTTP ${codeStr}`;
    statusLabel.set_markup(`<span foreground="${color}">●</span> <span foreground="${color}">${esc(t)}</span>`);

    if (typeof meta.durationMs === "number") durationLabel.label = `${Math.round(meta.durationMs)} ms`;
    else durationLabel.label = "";

    if (typeof meta.sizeBytes === "number") sizeLabel.label = `${(meta.sizeBytes / 1024).toFixed(1)} KB`;
    else sizeLabel.label = "";
  };

  const setText = (text: string) => {
    applyJsonHighlight(text);
    viewStack.visible_child_name = "body";
  };

  const setJson = (value: unknown) => {
    try {
      applyJsonHighlight(JSON.stringify(value, null, 2));
    } catch {
      applyJsonHighlight(String(value));
    }
    viewStack.visible_child_name = "body";
  };

  const setError = (message: string) => {
    applyJsonHighlight(message);
    viewStack.visible_child_name = "body";
  };

  const setHeaders = (headers: Record<string, string>) => {
    while (true) {
      const child = headersList.get_first_child();
      if (!child) break;
      headersList.remove(child);
    }

    const keys = Object.keys(headers).sort((a, b) => a.localeCompare(b));
    for (const k of keys) {
      const row = new Gtk.ListBoxRow();
      row.selectable = false;
      row.activatable = false;

      const box = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6,
        margin_top: 10,
        margin_bottom: 10,
        margin_start: 12,
        margin_end: 12,
      });

      const keyLabel = new Gtk.Label({ label: k, xalign: 0 });
      keyLabel.css_classes = ["dim-label"];

      const valueLabel = new Gtk.Label({
        label: String(headers[k] ?? ""),
        xalign: 0,
        wrap: true,
        wrap_mode: Pango.WrapMode.WORD_CHAR,
        selectable: true,
      });

      box.append(keyLabel);
      box.append(valueLabel);

      row.set_child(box);
      headersList.append(row);
    }
  };

  return {
    widget: root,
    setText,
    setJson,
    setError,
    setHeaders,
    setMeta,
  };
}
