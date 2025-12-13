import Gtk from "gi://Gtk?version=4.0";

export type InputBar = {
  widget: Gtk.Widget;
  setRequest: (method: string, url: string) => void;
  getRequest: () => { method: string; url: string };
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
  const crudDropDown = Gtk.DropDown.new_from_strings(methods);

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
    const item = crudDropDown.get_selected_item();
    if (!item) return "GET";
    const anyItem = item as any;
    if (typeof anyItem.get_string === "function") return anyItem.get_string();
    if (typeof anyItem.string === "string") return anyItem.string;
    return String(anyItem);
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
    const idx = methods.indexOf(m);
    if (idx >= 0) crudDropDown.set_selected(idx);
  };

  const triggerSend = () => {
    const url = getUrl();
    options.onSend?.(getSelectedMethod(), String(url ?? ""));
  };

  actionButton.connect("clicked", triggerSend);
  entry.connect("activate", triggerSend);

  box.append(crudDropDown);
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
  } satisfies InputBar;
}
