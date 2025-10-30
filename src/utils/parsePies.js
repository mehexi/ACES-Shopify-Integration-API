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

    // Core identifiers
    const partNumber = item.PartNumber || item.ItemID || "";
    const baseId = item.BaseItemID || "";
    const brand = item.BrandLabel || "Unknown Brand";

    // Descriptions
    const descs = item.Descriptions?.Description || [];
    const descArray = Array.isArray(descs) ? descs : [descs];

    const title =
      descArray.find((d) => d.DescriptionCode === "TLE")?._ ||
      descArray.find((d) => d.DescriptionCode === "SHO")?._ ||
      partNumber;

    let shortDesc = "";
    let longDesc = "";
    for (const d of descArray) {
      if (d.DescriptionCode === "SHO") shortDesc = d._ || d;
      if (d.DescriptionCode === "EXT" || d.DescriptionCode === "DES") {
        longDesc += `<p>${d._ || d}</p>\n`;
      }
    }

    // Attributes
    const attrs = {};
    const attributes = item.ProductAttributes?.ProductAttribute || [];
    const attrArray = Array.isArray(attributes) ? attributes : [attributes];
    for (const a of attrArray) {
      if (!a || !a.AttributeID) continue;
      attrs[a.AttributeID] = a._ || a.Value || "";
    }

    // Dimensions & weight
    const pkg = item.Packages?.Package || {};
    const dims = pkg.Dimensions || {};
    const weights = pkg.Weights || {};
    const length = dims.ShippingLength || "";
    const width = dims.ShippingWidth || "";
    const height = dims.ShippingHeight || "";
    const weight = weights.Weight || "";
    const qtyEach = pkg.QuantityofEaches || 1;

    // Pricing
const pricing = {};
const prices = item.Prices?.Pricing || []; // ✅ note the plural "Prices"
const priceArray = Array.isArray(prices) ? prices : [prices];

for (const pr of priceArray) {
  const code = pr.PriceType || "";
  const value = parseFloat(pr.Price?._ || pr.Price || 0); // ✅ handle nested <Price> node
  if (code && !isNaN(value)) {
    pricing[code] = value;
  }
}

    // Categories
    const category = item.PartTypeName || item.PartTerminologyID || "Uncategorized";
    const piesSegment = item.PIESSegment || "";
    const piesBase = item.PIESBase || "";
    const piesSub = item.PIESSub || "";

    // ✅ Digital Assets (fixed logic)
    const digitalAssets = item.DigitalAssets?.DigitalFileInformation || item.DigitalAssets?.[0]?.DigitalFileInformation || [];
    const assetArray = Array.isArray(digitalAssets) ? digitalAssets : [digitalAssets];
    const imageUrls = [];

    for (const asset of assetArray) {
      const uri = asset.URI || asset.URI?.[0];
      if (uri && typeof uri === "string" && uri.startsWith("http")) {
        imageUrls.push(uri);
      }
    }

    // Push structured result
    result.push({
      title: title?.trim() || "",
      sku: partNumber || baseId,
      vendor: brand,
      shortDesc: shortDesc?.trim() || "",
      longDesc,
      attributes: attrs,
      pricing,
      qtyAvailable: qtyEach,
      weight,
      dimensions: `${length}x${width}x${height}`,
      category,
      piesSegment,
      piesBase,
      piesSub,
      images: imageUrls, // ✅ now contains full URLs
    });
  }

  return result;
}
