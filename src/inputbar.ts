import Gtk from "gi://Gtk?version=4.0";

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

  const crudDropDown = Gtk.DropDown.new_from_strings([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
  ]);

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

  const triggerSend = () => {
    const url = (entry as any).get_text ? (entry as any).get_text() : (entry as any).text;
    options.onSend?.(getSelectedMethod(), String(url ?? ""));
  };

  actionButton.connect("clicked", triggerSend);
  entry.connect("activate", triggerSend);

  box.append(crudDropDown);
  box.append(entry);
  box.append(actionButton);

  return box;
}
