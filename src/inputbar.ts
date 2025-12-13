import Gtk from "gi://Gtk?version=4.0";

export type InputBar = {
  widget: Gtk.Widget;
  setRequest: (method: string, url: string) => void;
  getRequest: () => { method: string; url: string };
  setUrl: (url: string) => void;
};

type InputBarOptions = {
  onSend?: (method: string, url: string) => void;
};

export default function createInputBar(options: InputBarOptions = {}) {
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    hexpand: true,
    halign: Gtk.Align.FILL,
    spacing: 2,
    css_classes: ["linked"],
  });

  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
  let selectedMethod = methods[0];

  const methodLabel = new Gtk.Label({ label: selectedMethod });
  const methodButton = new Gtk.MenuButton({
    child: methodLabel,
  });

  const methodPopover = new Gtk.Popover();
  methodButton.set_popover(methodPopover);

  const methodList = new Gtk.ListBox();
  methodList.selection_mode = Gtk.SelectionMode.NONE;

  for (const m of methods) {
    const row = new Gtk.ListBoxRow();
    row.selectable = false;
    row.activatable = false;

    const btn = new Gtk.Button({
      label: m,
      css_classes: ["flat"],
    });
    btn.halign = Gtk.Align.FILL;
    btn.hexpand = true;

    btn.connect("clicked", () => {
      selectedMethod = m;
      methodLabel.label = m;
      methodPopover.popdown();
    });

    row.set_child(btn);
    methodList.append(row);
  }

  methodPopover.set_child(methodList);

  const entry = new Gtk.Entry({
    hexpand: true,
    buffer: new Gtk.EntryBuffer({
      text: "https://jsonplaceholder.typicode.com/posts",
    }),
  });

  const actionButton = new Gtk.Button({
    label: "Send",
    css_classes: ["suggested-action"],
  });

  const getSelectedMethod = () => {
    return String(selectedMethod ?? "GET");
  };

  const getUrl = () => {
    const anyEntry = entry as any;
    return anyEntry.get_text ? anyEntry.get_text() : anyEntry.text;
  };

  const setUrl = (url: string) => {
    const anyEntry = entry as any;
    if (typeof anyEntry.set_text === "function") anyEntry.set_text(url);
    else anyEntry.text = url;
  };

  const setMethod = (method: string) => {
    const m = String(method ?? "GET").toUpperCase();
    if (methods.includes(m)) {
      selectedMethod = m;
      methodLabel.label = m;
    }
  };

  const triggerSend = () => {
    const url = getUrl();
    options.onSend?.(getSelectedMethod(), String(url ?? ""));
  };

  actionButton.connect("clicked", triggerSend);
  entry.connect("activate", triggerSend);

  box.append(methodButton);
  box.append(entry);
  box.append(actionButton);

  return {
    widget: box,
    setRequest: (method: string, url: string) => {
      setMethod(method);
      setUrl(url);
      try {
        (entry as any).grab_focus?.();
      } catch {
      }
    },
    getRequest: () => ({ method: getSelectedMethod(), url: String(getUrl() ?? "") }),
    setUrl: (url: string) => setUrl(String(url ?? "")),
  } satisfies InputBar;
}
