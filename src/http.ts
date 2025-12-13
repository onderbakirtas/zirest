import GLib from "gi://GLib";
import Soup from "gi://Soup?version=3.0";

export type HttpResponse = {
  status: number;
  statusText: string;
  ok: boolean;
  durationMs: number;
  sizeBytes: number;
  text: () => Promise<string>;
};

const session = new Soup.Session();

const ByteArray = (imports as any).byteArray;

const bytesToString = (bytes: GLib.Bytes): string => {
  return ByteArray.toString(ByteArray.fromGBytes(bytes));
};

const stringToBytes = (text: string): GLib.Bytes => {
  return new GLib.Bytes(ByteArray.fromString(text));
};

export async function httpRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<HttpResponse> {
  const method = options.method ?? "GET";

  const startedAtUs = GLib.get_monotonic_time();

  const message = ((Soup.Message as any).new(method, url) ?? new (Soup as any).Message({ method, uri: url })) as any;

  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      message.request_headers.append(k, v);
    }
  }

  if (options.body != null) {
    const bytes = stringToBytes(options.body);
    if (typeof message.set_request_body_from_bytes === "function") {
      message.set_request_body_from_bytes("application/json", bytes);
    } else if (typeof message.set_request_body === "function") {
      message.set_request_body("application/json", bytes);
    }
  }

  const bytes: GLib.Bytes = await new Promise((resolve, reject) => {
    session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (_s: any, res: any) => {
      try {
        resolve(session.send_and_read_finish(res));
      } catch (e) {
        reject(e);
      }
    });
  });

  const finishedAtUs = GLib.get_monotonic_time();
  const durationMs = Math.max(0, (finishedAtUs - startedAtUs) / 1000);
  const sizeBytes = ByteArray.fromGBytes(bytes).length;

  const status = message.get_status ? message.get_status() : message.status_code;
  const statusText =
    (message.get_reason_phrase ? message.get_reason_phrase() : message.reason_phrase) ?? "";

  return {
    status,
    statusText: String(statusText),
    ok: status >= 200 && status < 300,
    durationMs,
    sizeBytes,
    text: async () => bytesToString(bytes),
  };
}
