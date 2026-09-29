import {
  Html,
  Head,
  Text,
  Tailwind,
  Heading,
  Row,
  Column,
  Button,
  Font,
  Section,
  Hr,
} from "react-email";

type Props = {
  dropoffTime: string;
  pickupTime: string;
  pickupLocation: string;
  destination: string;
  date: string;
  messages: string[];
};

export default function NewMessageFromDriverEmail({
  date,
  dropoffTime,
  pickupTime,
  pickupLocation,
  destination,
  messages,
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
        <Section className="border border-solid border-[#22070B26] rounded-[8px] p-[16px] mb-[16px]">
          <Row className="m-0">
            <Column width={40} className="align-top">
              <div className="h-[24px] w-[24px] rounded-full border border-solid" />
            </Column>
            <Column>
              {messages.map((message, index) => (
                <table
                  key={index}
                  cellPadding={0}
                  cellSpacing={0}
                  role="presentation"
                  className={index > 0 ? "mt-[10px]" : ""}
                >
                  <tr>
                    <td className="rounded-[8px] bg-[#EFEDED] p-[12px]">
                      <Text
                        className="m-0"
                        style={{ fontSize: "14px", lineHeight: "20px" }}
                      >
                        {message}
                      </Text>
                    </td>
                  </tr>
                </table>
              ))}
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
        <Section className="border border-solid border-[#22070B26] rounded-[8px] p-[16px] mb-[16px]">
          <Row className="m-0">
            <Column align="left">
              <Text
                className="m-0 font-bold"
                style={{ fontSize: "14px", lineHeight: "20px" }}
              >
                {date}
              </Text>
            </Column>
          </Row>

          <Row className="m-0 mt-[12px]">
            <Column className="w-1/2" align="left">
              <Text
                className="m-0"
                style={{
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: "#22070B80",
                }}
              >
                Pickup
              </Text>
            </Column>
            <Column className="w-1/2" align="right">
              <Text
                className="m-0"
                style={{
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: "#22070B80",
                }}
              >
                Dropoff
              </Text>
            </Column>
          </Row>

          <Row className="m-0 mt-[4px]">
            <Column className="w-1/3" align="left">
              <Text
                className="m-0 font-bold"
                style={{ fontSize: "18px", lineHeight: "24px" }}
              >
                {pickupTime}
              </Text>
            </Column>
            <Column className="w-1/3" align="center">
              <Hr className="border border-solid border-[#22070B26]" />
            </Column>
            <Column className="w-1/3" align="right">
              <Text
                className="m-0 font-bold"
                style={{ fontSize: "18px", lineHeight: "24px" }}
              >
                {dropoffTime}
              </Text>
            </Column>
          </Row>

          <Row className="m-0 mt-[4px]">
            <Column className="w-1/2" align="left">
              <Text
                className="m-0"
                style={{
                  fontSize: "14px",
                  lineHeight: "20px",
                  color: "#22070B",
                }}
              >
                {pickupLocation}
              </Text>
            </Column>
            <Column className="w-1/2" align="right">
              <Text
                className="m-0"
                style={{
                  fontSize: "14px",
                  lineHeight: "20px",
                  color: "#22070B",
                }}
              >
                {destination}
              </Text>
            </Column>
          </Row>
        </Section>

        <Row>
          <Column align="center">
            <Row>
              <td align="center" className="w-1/2 pr-[16px]" colSpan={1}>
                <Button
                  className="box-border w-full rounded-[4px] bg-[#183777] px-[20px] py-[12px] text-center font-semibold text-white"
                  style={{
                    fontSize: "12px",
                    lineHeight: "19.6px",
                    padding: "12px 20px",
                    width: "100%",
                  }}
                  href=""
                >
                  Chat with driver
                </Button>
              </td>
              <td align="center" className="w-1/2" colSpan={1}>
                <Button
                  className="box-border w-full rounded-[4px] border border-[#416EBC] border-solid bg-white px-[20px] py-[12px] text-center font-semibold text-[#183777]"
                  style={{
                    fontSize: "12px",
                    lineHeight: "19.6px",
                    padding: "12px 20px",
                    width: "100%",
                  }}
                  href=""
                >
                  View ride details
                </Button>
              </td>
            </Row>
          </Column>
        </Row>
      </Tailwind>
    </Html>
  );
}

NewMessageFromDriverEmail.PreviewProps = {
  date: "Thursday, July 30",
  pickupTime: "2:30 PM",
  dropoffTime: "2:45 PM",
  pickupLocation: "Exhibition Hall",
  destination: "Tech Square Eastbound",
  messages: [
    "This is a message.",
    "This is a longer message because I have arrived at your location.",
  ],
};
