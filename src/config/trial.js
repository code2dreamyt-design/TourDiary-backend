// ---------------------------------------------------------------------------
// Launch-offer free trial.
//
// Users can claim `TRIAL_DAYS` days of free access (POST /api/subscription/claim-trial)
// only while the offer end moment is in the future.
//
// The end moment is now managed from the admin portal (Admin -> Offer) and
// stored in the database; change it there at any time, no redeploy or app
// rebuild needed. TRIAL_OFFER_ENDS_AT below is only the DEFAULT, used until the
// admin saves a date or if the database cannot be read.
// ---------------------------------------------------------------------------
export const TRIAL_OFFER_ENDS_AT = new Date("2026-10-21T00:00:00+05:30"); // last claim moment: 20 Oct 11:59 PM IST
export const TRIAL_DAYS = 30;

export const isTrialOfferOpen = (now = new Date()) => now < TRIAL_OFFER_ENDS_AT;
