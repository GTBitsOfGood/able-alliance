import { XMLParser, XMLValidator } from "fast-xml-parser";

export type CASValidationResult =
  { success: true; username: string } | { success: false; error: string };

const xmlParser = new XMLParser({
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

/** Only cas:user is required; released profile attributes are ignored. */
export function parseCASResponse(xml: string): CASValidationResult {
  if (XMLValidator.validate(xml) !== true) {
    return { success: false, error: "CAS response was not valid XML" };
  }
  const response = xmlParser.parse(xml)?.serviceResponse;
  if (
    response &&
    typeof response === "object" &&
    "authenticationFailure" in response
  ) {
    return { success: false, error: "CAS authentication failed" };
  }
  const username = response?.authenticationSuccess?.user;
  if (typeof username !== "string" || !username.trim()) {
    return { success: false, error: "No user found in CAS response" };
  }
  return { success: true, username: username.trim() };
}
