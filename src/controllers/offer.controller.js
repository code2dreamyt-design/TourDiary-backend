import { getOfferInfo } from "../services/offer.service.js";

// GET /api/offer   (public, no auth) - used by the app banner and the landing page.
export const getOffer = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await getOfferInfo());
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
