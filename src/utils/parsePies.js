import { parseStringPromise } from "xml2js";

export async function parsePies(xmlBuffer) {
  const xml = xmlBuffer.toString("utf8");
  const parsed = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });

  const pies = parsed.PIES || {};
  const items = pies.Items?.Item || [];
  const list = Array.isArray(items) ? items : [items];
  const result = [];

  for (const item of list) {
    if (!item) continue;

    const partNumber = item.PartNumber || "";
    const baseId = item.BaseItemID || "";
    const brand = item.BrandLabel || "Unknown Brand";

    const descs = item.Descriptions?.Description || [];
    const descArray = Array.isArray(descs) ? descs : [descs];

    const title = descArray.find((d) => d.DescriptionCode === "TLE")?._ || partNumber;

    let shortDesc = "";
    let longDesc = "";
    for (const d of descArray) {
      if (d.DescriptionCode === "SHO") shortDesc = d._ || d;
      if (d.DescriptionCode === "EXT") longDesc += `<p>${d._ || d}</p>\n`;
    }

    const attributes = item.ProductAttributes?.ProductAttribute || [];
    const attrArray = Array.isArray(attributes) ? attributes : [attributes];
    const attributeText = attrArray.map((a) => `${a.AttributeID}: ${a._}`).join(", ");

    const pkg = item.Packages?.Package || {};
    const dims = pkg.Dimensions || {};
    const weights = pkg.Weights || {};
    const height = dims.ShippingHeight || "";
    const width = dims.ShippingWidth || "";
    const length = dims.ShippingLength || "";
    const weight = weights.Weight || "";

    const digitalAssets = item.DigitalAssets?.DigitalFileInformation || [];
    const assetArray = Array.isArray(digitalAssets) ? digitalAssets : [digitalAssets];
    const images = assetArray.map((a) => a.FileName).filter(Boolean);

    result.push({
      title: title || `Part ${partNumber}`,
      sku: partNumber || baseId,
      vendor: brand,
      shortDesc,
      longDesc,
      attributes: attributeText,
      weight,
      dimensions: `${length}x${width}x${height}`,
      images
    });
  }

  return result;
}
