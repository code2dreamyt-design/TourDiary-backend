// ---------------------------------------------------------------------------
// Launch-offer free trial.
//
// Users can claim `TRIAL_DAYS` days of free access (POST /api/subscription/claim-trial)
// only while `TRIAL_OFFER_ENDS_AT` is in the future. After that moment the
// endpoint closes by itself - no flag, no cleanup.
//
// TO EXTEND THE OFFER: change only the date below (keep the +05:30 offset,
// it means India time) and redeploy.
// Example: run the offer until the end of 15 Oct -> "2026-10-16T00:00:00+05:30"
// ---------------------------------------------------------------------------
export const TRIAL_OFFER_ENDS_AT = new Date("2026-10-10T00:00:00+05:30"); // last claim moment: 9 Oct 11:59 PM IST
export const TRIAL_DAYS = 30;

export const isTrialOfferOpen = (now = new Date()) => now < TRIAL_OFFER_ENDS_AT;
