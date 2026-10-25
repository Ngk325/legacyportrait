// Fails loudly while any Gelato product UID is missing (master prompt 7.4). Run before switching FULFILLMENT_MODE to gelato_*.
import { GELATO_PRODUCT_UIDS, GELATO_SHIPMENT_METHOD_UID, missingGelatoUids } from "../config/gelato-products.js";

const missing = missingGelatoUids();
const noShip = Object.entries(GELATO_SHIPMENT_METHOD_UID).filter(([, v]) => !v).map(([k]) => k);
console.log(`${Object.keys(GELATO_PRODUCT_UIDS).length} SKUs, ${missing.length} without a Gelato productUid.`);
if (missing.length || noShip.length) {
  for (const k of missing) console.error("MISSING productUid: " + k);
  for (const k of noShip) console.error("MISSING shipmentMethodUid: " + k);
  process.exit(1);
}
console.log("All Gelato UIDs present.");
