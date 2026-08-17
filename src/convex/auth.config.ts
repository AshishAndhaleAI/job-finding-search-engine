export default {
  providers: [
    {
      // Site URL used by Convex Auth for callbacks. For local dev this is the
      // local deployment; set CONVEX_SITE_URL to your production site URL when
      // you deploy to Convex cloud.
      domain: process.env.CONVEX_SITE_URL ?? "http://127.0.0.1:3210",
      applicationID: "convex",
    },
  ],
};
