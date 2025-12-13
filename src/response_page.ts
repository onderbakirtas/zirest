import Gio from "gi://Gio";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";

type ResponsePage = {
  widget: Gtk.Widget;
  setText: (text: string) => void;
  setJson: (value: unknown) => void;
  setError: (message: string) => void;
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

class JsonNodeBase extends GObject.Object {
  key: string;
  value: any;
  kind: "object" | "array" | "string" | "number" | "boolean" | "null" | "other";

  constructor(key: string, value: any) {
    super();
    this.key = key;
    this.value = value;

    if (value === null) this.kind = "null";
    else if (Array.isArray(value)) this.kind = "array";
    else if (typeof value === "object") this.kind = "object";
    else if (typeof value === "string") this.kind = "string";
    else if (typeof value === "number") this.kind = "number";
    else if (typeof value === "boolean") this.kind = "boolean";
    else this.kind = "other";
  }

  isContainer() {
    return this.kind === "object" || this.kind === "array";
  }
}

const JsonNode = GObject.registerClass(JsonNodeBase);
type JsonNodeT = InstanceType<typeof JsonNode>;

export default function createResponsePage(): ResponsePage {
  const stack = new Gtk.Stack();
  stack.hexpand = true;
  stack.vexpand = true;

  const textBuffer = new Gtk.TextBuffer();
  const textView = new Gtk.TextView({
    buffer: textBuffer,
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
  const textScrolled = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: true,
  });
  textScrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
  textScrolled.set_child(textView);

  const rootStore = new Gio.ListStore({
    item_type: (JsonNode as any).$gtype,
  });

  const createChildModel = (item: any) => {
    const node = item as JsonNodeT;
    if (!node.isContainer()) return null;

    const store = new Gio.ListStore({ item_type: (JsonNode as any).$gtype });
    if (node.kind === "array") {
      for (let i = 0; i < node.value.length; i++) {
        store.append(new JsonNode(`[${i}]`, node.value[i]));
      }
    } else {
      for (const k of Object.keys(node.value)) {
        store.append(new JsonNode(`"${k}"`, node.value[k]));
      }
    }
    return store;
  };

  const treeModel = (Gtk.TreeListModel as any).new(
    rootStore,
    false,
    false,
    createChildModel,
  ) as Gtk.TreeListModel;

  const selection = new Gtk.SingleSelection({ model: treeModel });
  const factory = new Gtk.SignalListItemFactory();

  factory.connect("setup", (_f: any, listItem: any) => {
    const expander = new Gtk.TreeExpander();
    expander.hexpand = true;
    expander.valign = Gtk.Align.START;

    const rowBox = new Gtk.Box({
      orientation: Gtk.Orientation.HORIZONTAL,
      spacing: 6,
      hexpand: true,
    });
    rowBox.valign = Gtk.Align.START;

    const keyLabel = new Gtk.Label({
      xalign: 0,
      yalign: 0,
      use_markup: true,
      selectable: true,
    });
    keyLabel.valign = Gtk.Align.START;
    const valueLabel = new Gtk.Label({
      xalign: 0,
      yalign: 0,
      use_markup: true,
      selectable: true,
      hexpand: true,
      wrap: true,
      wrap_mode: Pango.WrapMode.WORD_CHAR,
    });
    valueLabel.valign = Gtk.Align.START;

    rowBox.append(keyLabel);
    rowBox.append(valueLabel);

    (listItem as any)._keyLabel = keyLabel;
    (listItem as any)._valueLabel = valueLabel;

    expander.set_child(rowBox);
    listItem.set_child(expander);
  });

  factory.connect("bind", (_f: any, listItem: any) => {
    const row = listItem.get_item() as any;
    const expander = listItem.get_child() as any;
    expander.set_list_row(row);

    const node = row.get_item() as JsonNodeT;
    const keyLabel = (listItem as any)._keyLabel as Gtk.Label;
    const valueLabel = (listItem as any)._valueLabel as Gtk.Label;

    const keyText = node.key ? node.key : "";
    if (keyText.length > 0) {
      keyLabel.set_markup(span(keyText, COLORS.key) + span(":", COLORS.punctuation));
      keyLabel.visible = true;
    } else {
      keyLabel.visible = false;
    }

    if (node.kind === "string") {
      valueLabel.set_markup(span(JSON.stringify(node.value), COLORS.string));
    } else if (node.kind === "number") {
      valueLabel.set_markup(span(String(node.value), COLORS.number));
    } else if (node.kind === "boolean") {
      valueLabel.set_markup(span(String(node.value), COLORS.boolean));
    } else if (node.kind === "null") {
      valueLabel.set_markup(span("null", COLORS.null));
    } else if (node.kind === "array") {
      valueLabel.set_markup(
        span("[", COLORS.punctuation) +
          span(`…`, COLORS.punctuation) +
          span("]", COLORS.punctuation),
      );
    } else if (node.kind === "object") {
      valueLabel.set_markup(
        span("{", COLORS.punctuation) +
          span(`…`, COLORS.punctuation) +
          span("}", COLORS.punctuation),
      );
    } else {
      valueLabel.set_markup(span(String(node.value), COLORS.punctuation));
    }
  });

  const listView = new Gtk.ListView({
    model: selection,
    factory,
    hexpand: true,
    vexpand: true,
  });

  const treeScrolled = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: true,
  });
  treeScrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
  treeScrolled.set_child(listView);

  stack.add_named(textScrolled, "text");
  stack.add_named(treeScrolled, "tree");
  stack.visible_child_name = "text";

  const setText = (text: string) => {
    stack.visible_child_name = "text";
    textBuffer.set_text(text, -1);
  };

  const setJson = (value: unknown) => {
    stack.visible_child_name = "tree";
    rootStore.remove_all();

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        rootStore.append(new JsonNode(`[${i}]`, value[i]));
      }
      return;
    }

    if (value && typeof value === "object") {
      for (const k of Object.keys(value as any)) {
        rootStore.append(new JsonNode(`"${k}"`, (value as any)[k]));
      }
      return;
    }

    rootStore.append(new JsonNode("", value));
  };

  const setError = (message: string) => {
    stack.visible_child_name = "text";
    textBuffer.set_text(message, -1);
  };

  return {
    widget: stack,
    setText,
    setJson,
    setError,
  };
}
