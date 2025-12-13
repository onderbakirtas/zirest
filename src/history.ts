import Gio from "gi://Gio";
import GLib from "gi://GLib";

export type RequestHistoryItem = {
  method: string;
  url: string;
  at: string;
};

const ByteArray = (imports as any).byteArray;

const getHistoryFile = (): Gio.File => {
  const dirPath = GLib.build_filenamev([GLib.get_user_data_dir(), "zirest"]);
  const dir = Gio.File.new_for_path(dirPath);
  try {
    (dir as any).make_directory_with_parents(null);
  } catch {
  }

  const filePath = GLib.build_filenamev([dirPath, "request_history.json"]);
  return Gio.File.new_for_path(filePath);
};

export function loadRequestHistory(): RequestHistoryItem[] {
  const file = getHistoryFile();

  try {
    if (!file.query_exists(null)) return [];

    const anyFile = file as any;
    const [_ok, contents] = anyFile.load_contents(null);
    const text = ByteArray.toString(contents);

    const parsed = JSON.parse(String(text));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((x) => x && typeof x === "object")
      .map((x: any) => ({
        method: String(x.method ?? "GET"),
        url: String(x.url ?? ""),
        at: String(x.at ?? new Date().toISOString()),
      }))
      .filter((x) => x.url.length > 0);
  } catch {
    return [];
  }
}

export function saveRequestHistory(items: RequestHistoryItem[]): void {
  const file = getHistoryFile();

  try {
    const payload = JSON.stringify(items, null, 2);
    const bytes = ByteArray.fromString(payload);

    (file as any).replace_contents(
      bytes,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null,
    );
  } catch {
  }
}

export function addRequestHistoryItem(input: {
  method: string;
  url: string;
  at?: string;
}): RequestHistoryItem[] {
  const item: RequestHistoryItem = {
    method: String(input.method ?? "GET"),
    url: String(input.url ?? ""),
    at: String(input.at ?? new Date().toISOString()),
  };

  if (!item.url) return loadRequestHistory();

  const existing = loadRequestHistory();

  const normalizedMethod = item.method.toUpperCase();
  const normalizedUrl = item.url;

  const deduped = existing.filter(
    (x) => !(String(x.method).toUpperCase() === normalizedMethod && String(x.url) === normalizedUrl),
  );

  const next = [item, ...deduped].slice(0, 100);
  saveRequestHistory(next);
  return next;
}
