/**
 * GJS example showing how to build javascript applications using Libadwaita Application.
 * @see https://gitlab.gnome.org/GNOME/libadwaita/-/blob/main/examples/hello-world/hello.c
 */

import Adw from "gi://Adw";
import GLib from "gi://GLib";
import Gtk from "gi://Gtk?version=4.0";
import Pango from "gi://Pango";
import createInputBar from "./src/inputbar";
import createResponsePage from "./src/response_page";
import { httpRequest } from "./src/http";
import {
  addRequestHistoryItem,
  loadRequestHistory,
  RequestHistoryItem,
  saveRequestHistory,
} from "./src/history";

// const _loop = GLib.MainLoop.new(null, false);

const app = new Adw.Application({
  applicationId: "dev.onderb.zirest",
});

const AdwStyleManager = Adw.StyleManager.get_default();
AdwStyleManager.colorScheme = Adw.ColorScheme.FORCE_DARK;

const onActivate = (app: Adw.Application) => {
  const window = new Adw.ApplicationWindow({
    application: app,
    title: "Zirest",
    default_width: 640,
    default_height: 480,
  });



  window.connect("close-request", () => {
    app.quit();
    return false;
  });


  const header = new Adw.HeaderBar({
    title_widget: new Gtk.Label({ label: "Zirest" }),
  });

  const historyButton = new Gtk.MenuButton({ icon_name: "document-open-recent-symbolic" });
  header.pack_start(historyButton);

  const historyPopover = new Gtk.Popover();
  historyButton.set_popover(historyPopover);

  const historyPopoverRoot = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 8,
    margin_top: 10,
    margin_bottom: 10,
    margin_start: 10,
    margin_end: 10,
  });

  const historySearch = new Gtk.SearchEntry({
    placeholder_text: "Search",
  });

  historyPopoverRoot.append(historySearch);

  const historyList = new Gtk.ListBox();
  historyList.selection_mode = Gtk.SelectionMode.NONE;

  const historyScrolled = new Gtk.ScrolledWindow({
    hexpand: true,
    vexpand: false,
  });
  historyScrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
  (historyScrolled as any).set_min_content_width?.(420);
  (historyScrolled as any).set_min_content_height?.(260);
  (historyScrolled as any).set_max_content_height?.(260);
  try {
    (historyScrolled as any).propagate_natural_height = true;
  } catch {
  }
  historyScrolled.set_child(historyList);

  historyPopoverRoot.append(historyScrolled);
  historyPopover.set_child(historyPopoverRoot);

  // const handle = new Gtk.WindowHandle();

  // const customHeader = new Gtk.Box({
  //   orientation: Gtk.Orientation.HORIZONTAL,
  //   spacing: 8,
  //   margin_top: 8,
  //   margin_bottom: 8,
  //   margin_start: 8,
  //   margin_end: 8,
  // });

  // customHeader.append(new Gtk.Label({ label: "Ziresttt" }));

  // const close = new Gtk.Button({ icon_name: "window-close-symbolic" });
  // close.connect("clicked", () => {
  //   app.quit();
  // });

  // header.append(close);

  const root = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
    margin_start: 6,
    margin_end: 6,
    margin_top: 6,
    margin_bottom: 6,
  })

  const responsePage = createResponsePage();

  const placeholder = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 12,
    hexpand: true,
    vexpand: true,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
  });

  const emptyIcon = new Gtk.Image({
    icon_name: "network-workgroup-symbolic",
    pixel_size: 96,
  });

  const emptyTitle = new Gtk.Label({
    label: "No response yet",
    wrap: true,
    justify: Gtk.Justification.CENTER,
  });
  emptyTitle.css_classes = ["title-2"];

  const emptySubtitle = new Gtk.Label({
    label: "Send a request to see its response here.",
    wrap: true,
    justify: Gtk.Justification.CENTER,
  });
  emptySubtitle.css_classes = ["dim-label"];

  placeholder.append(emptyIcon);
  placeholder.append(emptyTitle);
  placeholder.append(emptySubtitle);

  const contentStack = new Adw.ViewStack();
  contentStack.hexpand = true;
  contentStack.vexpand = true;
  contentStack.add_titled(placeholder, "empty", "");
  contentStack.add_titled(responsePage.widget, "response", "");
  contentStack.visible_child_name = "empty";

  const statusBar = new Gtk.CenterBox({
    orientation: Gtk.Orientation.HORIZONTAL,
    margin_top: 6,
  });
  statusBar.hexpand = true;

  const leftStatus = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 6,
  });
  leftStatus.hexpand = true;

  const statusCodeLabel = new Gtk.Label({ xalign: 0, use_markup: true, label: "" });
  const statusTextLabel = new Gtk.Label({ xalign: 0, label: "" });
  statusTextLabel.css_classes = ["dim-label"];

  leftStatus.append(statusCodeLabel);
  leftStatus.append(statusTextLabel);

  const rightStatus = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 10,
    halign: Gtk.Align.END,
  });

  const durationLabel = new Gtk.Label({ xalign: 0, label: "" });
  durationLabel.css_classes = ["dim-label"];

  const sizeLabel = new Gtk.Label({ xalign: 0, label: "" });
  sizeLabel.css_classes = ["dim-label"];

  rightStatus.append(durationLabel);
  rightStatus.append(sizeLabel);

  statusBar.set_start_widget(leftStatus);
  statusBar.set_end_widget(rightStatus);

  const setStatus = (code: number | string, text: string) => {
    const codeStr = String(code);
    const c = typeof code === "number" ? code : Number(code);

    let color = "#D4D4D4";
    if (!Number.isNaN(c)) {
      if (c >= 200 && c < 300) color = "#6A9955";
      else if (c >= 300 && c < 400) color = "#569CD6";
      else if (c >= 400 && c < 500) color = "#F44747";
      else if (c >= 500 && c < 600) color = "#C586C0";
    }

    const esc = (s: string) => GLib.markup_escape_text(s, -1);
    statusCodeLabel.set_markup(`<span foreground=\"${color}\">${esc(codeStr)}</span>`);
    statusTextLabel.label = text;
  };

  const showResponse = () => {
    contentStack.visible_child_name = "response";
  };

  const formatHistoryDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const escMarkup = (s: string) => GLib.markup_escape_text(s, -1);

  let historyItems: RequestHistoryItem[] = loadRequestHistory();
  let historyQuery = "";

  const renderHistory = () => {
    while (true) {
      const child = historyList.get_first_child();
      if (!child) break;
      historyList.remove(child);
    }

    const q = historyQuery.trim().toLowerCase();
    const visibleItems = q
      ? historyItems.filter((x) => {
          const m = String(x.method ?? "").toLowerCase();
          const u = String(x.url ?? "").toLowerCase();
          return m.includes(q) || u.includes(q);
        })
      : historyItems;

    if (visibleItems.length === 0) {
      const row = new Gtk.ListBoxRow();
      row.set_child(new Gtk.Label({ label: q ? "No matches" : "No history", xalign: 0 }));
      row.selectable = false;
      row.activatable = false;
      historyList.append(row);
      return;
    }

    for (const item of visibleItems) {
      const row = new Gtk.ListBoxRow();
      row.selectable = false;
      row.activatable = false;

      const rowBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 8,
      });

      const selectBtn = new Gtk.Button({ css_classes: ["flat"] });
      selectBtn.hexpand = true;
      selectBtn.halign = Gtk.Align.FILL;

      const textBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2,
      });
      textBox.hexpand = true;

      const top = new Gtk.Label({ use_markup: true, xalign: 0 });
      top.set_markup(`<b>${escMarkup(`${item.method.toUpperCase()} ${item.url}`)}</b>`);
      top.ellipsize = Pango.EllipsizeMode.END;

      const bottom = new Gtk.Label({ label: formatHistoryDate(item.at), xalign: 0 });
      bottom.css_classes = ["dim-label"];

      textBox.append(top);
      textBox.append(bottom);
      selectBtn.set_child(textBox);

      selectBtn.connect("clicked", () => {
        inputBar.setRequest(item.method, item.url);
        historyPopover.popdown();
      });

      const removeBtn = new Gtk.Button({
        css_classes: ["flat"],
        icon_name: "window-close-symbolic",
      });
      removeBtn.valign = Gtk.Align.CENTER;
      removeBtn.connect("clicked", () => {
        historyItems = historyItems.filter(
          (x) => !(String(x.method) === String(item.method) && String(x.url) === String(item.url)),
        );
        saveRequestHistory(historyItems);
        renderHistory();
      });

      rowBox.append(selectBtn);
      rowBox.append(removeBtn);
      row.set_child(rowBox);
      historyList.append(row);
    }
  };

  historySearch.connect("search-changed", () => {
    historyQuery = (historySearch as any).get_text ? (historySearch as any).get_text() : "";
    renderHistory();
  });

  const inputBar = createInputBar({
    onSend: (method, url) => {
      historyItems = addRequestHistoryItem({ method, url });
      renderHistory();

      void (async () => {
        showResponse();

        setStatus("…", "Loading");
        durationLabel.label = "";
        sizeLabel.label = "";

        responsePage.setText("Loading...\n" + method + " " + url);

        try {
          const res = await httpRequest(url, { method });
          const text = await res.text();

          setStatus(res.status, res.statusText);
          durationLabel.label = `${Math.round(res.durationMs)} ms`;
          sizeLabel.label = `${(res.sizeBytes / 1024).toFixed(1)} KB`;

          try {
            responsePage.setJson(JSON.parse(text));
          } catch {
            responsePage.setText(text);
          }
        } catch (e) {
          setStatus("ERR", "Error");
          durationLabel.label = "";
          sizeLabel.label = "";
          responsePage.setError(String(e));
        }
      })();
    },
  });

  renderHistory();
  root.append(inputBar.widget);

  root.append(contentStack);
  root.append(statusBar);

  const view = new Adw.ToolbarView();
  view.add_top_bar(header);
  view.set_content(root);

  window.set_content(view)
  window.present();
};

app.connect("activate", onActivate);
// app.run([imports.system.programInvocationName].concat(ARGV));
app.run([]);
