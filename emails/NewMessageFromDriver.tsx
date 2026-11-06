import RideDetails from "./_components/RideDetails";
import EmailButton from "./_components/EmailButton";
import { ridePreview } from "./_components/preview";
import {
  Html,
  Head,
  Text,
  Tailwind,
  Heading,
  Row,
  Column,
  Font,
  Section,
} from "react-email";

type Props = {
  dropoffTime: string;
  pickupTime: string;
  pickupLocation: string;
  destination: string;
  date: string;
  messages: string[];
  rideUrl: string;
  chatUrl: string;
};

export default function NewMessageFromDriverEmail({
  date,
  dropoffTime,
  pickupTime,
  pickupLocation,
  destination,
  messages,
  rideUrl,
  chatUrl,
}: Props) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Visby Bold"
          fallbackFontFamily="Verdana"
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>
      <Tailwind>
        <Heading
          as="h3"
          style={{
            fontSize: "20px",
            lineHeight: "28px",
          }}
        >
          There&apos;s a new message about your scheduled ride on {date} at{" "}
          {pickupTime}
        </Heading>
        <Text
          style={{
            fontSize: "14px",
            lineHeight: "28px",
          }}
          className="m-0"
        >
          Chat History
        </Text>
        <Section style={{ border: "1px solid #DEDADB", marginBottom: "16px" }}>
          <Row>
            <Column style={{ padding: "16px" }}>
              <Row className="m-0">
                <Column width={40} valign="top">
                  <table
                    role="presentation"
                    width={24}
                    cellPadding={0}
                    cellSpacing={0}
                  >
                    <tbody>
                      <tr>
                        <td
                          align="center"
                          style={{
                            border: "1px solid #DEDADB",
                            padding: "4px",
                            fontSize: "12px",
                            lineHeight: "16px",
                          }}
                        >
                          D
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </Column>
                <Column>
                  {messages.map((message, index) => (
                    <table
                      key={index}
                      cellPadding={0}
                      cellSpacing={0}
                      role="presentation"
                      width="100%"
                    >
                      <tbody>
                        <tr>
                          <td style={{ paddingTop: index > 0 ? "10px" : "0" }}>
                            <table
                              role="presentation"
                              cellPadding={0}
                              cellSpacing={0}
                              width="100%"
                            >
                              <tbody>
                                <tr>
                                  <td
                                    style={{
                                      backgroundColor: "#EFEDED",
                                      padding: "12px",
                                    }}
                                  >
                                    <Text
                                      className="m-0"
                                      style={{
                                        fontSize: "14px",
                                        lineHeight: "20px",
                                      }}
                                    >
                                      {message}
                                    </Text>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ))}
                </Column>
              </Row>
            </Column>
          </Row>
        </Section>

        <Text
          style={{
            fontSize: "14px",
            lineHeight: "28px",
          }}
          className="m-0"
        >
          Ride Details
        </Text>
        <RideDetails
          {...{ date, pickupTime, dropoffTime, pickupLocation, destination }}
        />

        <Row>
          <Column width="50%" valign="top" style={{ paddingRight: "8px" }}>
            <EmailButton href={chatUrl}>Chat with driver</EmailButton>
          </Column>
          <Column width="50%" valign="top" style={{ paddingLeft: "8px" }}>
            <EmailButton href={rideUrl} secondary>
              View ride details
            </EmailButton>
          </Column>
        </Row>
      </Tailwind>
    </Html>
  );
}

NewMessageFromDriverEmail.PreviewProps = {
  ...ridePreview,
  messages: [
    "This is a message.",
    "This is a longer message because I have arrived at your location.",
  ],
};
