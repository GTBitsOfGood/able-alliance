import juno from "juno-sdk";

const apiKey = process.env.JUNO_API_KEY;
const baseURL = process.env.JUNO_BASE_URL;
if (!apiKey) {
  throw new Error("JUNO_API_KEY environment variable is required");
}
if (!baseURL) {
  throw new Error("JUNO_BASE_URL environment variable is required");
}

juno.init({
  apiKey,
  baseURL,
});

const junoEmailClient = juno.email;
export { junoEmailClient };
