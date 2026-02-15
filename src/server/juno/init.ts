import juno from "juno-sdk";

console.log("🔧 Initializing Juno SDK...");
console.log(
  "JUNO_API_KEY:",
  process.env.JUNO_API_KEY
    ? `${process.env.JUNO_API_KEY.substring(0, 10)}...`
    : "NOT SET",
);
console.log(
  "JUNO_BASE_URL:",
  process.env.JUNO_BASE_URL ||
    "https://api-gateway.whitesmoke-cea9a269.eastus.azurecontainerapps.io/",
);
console.log("JUNO_EMAIL_SENDER_EMAIL:", process.env.JUNO_EMAIL_SENDER_EMAIL);
console.log("JUNO_EMAIL_SENDER_NAME:", process.env.JUNO_EMAIL_SENDER_NAME);

juno.init({
  apiKey: process.env.JUNO_API_KEY ?? "",
  baseURL:
    process.env.JUNO_BASE_URL ||
    "https://api-gateway.whitesmoke-cea9a269.eastus.azurecontainerapps.io/",
});

console.log("✅ Juno SDK initialized successfully");

const junoEmailClient = juno.email;
export { junoEmailClient };
