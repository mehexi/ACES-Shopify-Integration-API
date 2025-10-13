import { parseStringPromise } from "xml2js";

export async function parseAces(xmlBuffer) {
  const xml = xmlBuffer.toString("utf8");
  const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });

  const aces = parsed.ACES || {};
  const apps = aces.App || [];
  const list = Array.isArray(apps) ? apps : [apps];

  const result = [];
  for (const app of list) {
    if (!app) continue;
    result.push({
      partNumber: app.Part || "",
      make: app.Make?.id || "",
      model: app.Model?.id || "",
      partType: app.PartType?.id || "",
      position: app.Position?.id || "",
      years: app.Years?.from && app.Years?.to ? `${app.Years.from}-${app.Years.to}` : ""
    });
  }
  return result;
}
