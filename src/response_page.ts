import GLib from "gi://GLib";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";
import GtkSource from "gi://GtkSource?version=5";

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

const esc = (s: string) => GLib.markup_escape_text(s, -1);

export default function createResponsePage(): ResponsePage {
  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
    hexpand: true,
    vexpand: true,
  });

  const languageManager = GtkSource.LanguageManager.get_default();
  const jsonLanguage = languageManager.get_language("json");

  const schemeManager = GtkSource.StyleSchemeManager.get_default();
  const getScheme = (candidates: string[]) => {
    for (const id of candidates) {
      try {
        const s = schemeManager.get_scheme(id);
        if (s) return s;
      } catch {
      }
    }
    return null;
  };

  const bodyBuffer = new GtkSource.Buffer();
  try {
    (bodyBuffer as any).highlight_matching_brackets = true;
  } catch {
  }
  const adwStyleManager = Adw.StyleManager.get_default();
  const applyThemeToBuffer = () => {
    try {
      const dark = Boolean((adwStyleManager as any).dark);
      const scheme = dark
        ? getScheme(["Adwaita-dark", "adwaita-dark", "oblivion", "cobalt", "kate"])
        : getScheme(["Adwaita", "adwaita", "classic", "tango"]);
      (bodyBuffer as any).style_scheme = scheme;
    } catch {
    }
  };
  applyThemeToBuffer();
  try {
    adwStyleManager.connect("notify::dark", applyThemeToBuffer);
  } catch {
  }

  const bodyView = new GtkSource.View({
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
  try {
    bodyView.show_line_numbers = true;
    bodyView.tab_width = 2;
    bodyView.indent_width = 2;
    bodyView.insert_spaces_instead_of_tabs = true;
  } catch {
  }
  const bodyScrolled = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: true,
  });
  bodyScrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

  bodyScrolled.set_child(bodyView);

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

  const notebook = new Gtk.Notebook({
    hexpand: true,
    vexpand: true,
  });
  try {
    notebook.show_border = false;
  } catch {
  }

  const bodyTabLabel = new Gtk.Label({ label: "Body" });
  const headersTabLabel = new Gtk.Label({ label: "Headers" });
  notebook.append_page(bodyScrolled, bodyTabLabel);
  notebook.append_page(headersScrolled, headersTabLabel);

  const setActiveTab = (index: number) => {
    try {
      notebook.set_current_page(index);
    } catch {
      (notebook as any).page = index;
    }
  };
  setActiveTab(0);

  const statusLine = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 10,
    halign: Gtk.Align.END,
    margin_top: 6,
    margin_bottom: 6,
  });

  const statusLabel = new Gtk.Label({ xalign: 0, use_markup: true, label: "" });
  const durationLabel = new Gtk.Label({ xalign: 0, label: "" });
  durationLabel.css_classes = ["dim-label"];
  const sizeLabel = new Gtk.Label({ xalign: 0, label: "" });
  sizeLabel.css_classes = ["dim-label"];

  statusLine.append(statusLabel);
  statusLine.append(durationLabel);
  statusLine.append(sizeLabel);

  root.append(notebook);
  root.append(statusLine);

  const setBody = (text: string, opts: { isJson?: boolean } = {}) => {
    bodyBuffer.set_text(String(text ?? ""), -1);
    try {
      if (opts.isJson) {
        (bodyBuffer as any).language = jsonLanguage;
        (bodyBuffer as any).highlight_syntax = true;
      } else {
        (bodyBuffer as any).language = null;
        (bodyBuffer as any).highlight_syntax = false;
      }
    } catch {
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
    statusLabel.set_markup(`<span foreground="${color}"><b>${esc(codeStr)}</b></span>`);

    if (typeof meta.durationMs === "number") durationLabel.label = `${Math.round(meta.durationMs)} ms`;
    else durationLabel.label = "";

    if (typeof meta.sizeBytes === "number") sizeLabel.label = `${(meta.sizeBytes / 1024).toFixed(1)} KB`;
    else sizeLabel.label = "";
  };

  const setText = (text: string) => {
    setBody(text, { isJson: false });
    setActiveTab(0);
  };

  const setJson = (value: unknown) => {
    try {
      setBody(JSON.stringify(value, null, 2), { isJson: true });
    } catch {
      setBody(String(value), { isJson: false });
    }
    setActiveTab(0);
  };

  const setError = (message: string) => {
    setBody(message, { isJson: false });
    setActiveTab(0);
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
