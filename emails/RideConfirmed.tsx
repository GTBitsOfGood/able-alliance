import {
  Html,
  Text,
  Tailwind,
  Heading,
  Section,
  Column,
  Row,
  Font,
  Head,
  Button,
  Img,
  Hr,
} from "react-email";

type Props = {
  name: string;
  dropoffTime: string;
  pickupTime: string;
  pickupLocation: string;
  destination: string;
  date: string;
  driverDetails?: {
    name: string;
    vehicleId: string;
    licensePlate: string;
    description?: string;
  };
};

export default function RideConfirmationEmail({
  name,
  date,
  dropoffTime,
  pickupTime,
  pickupLocation,
  destination,
  driverDetails,
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
          {name}, here are your ride details
        </Heading>
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

        <Section className="border border-solid border-[#22070B26] rounded-[8px] p-[16px] mb-[16px]">
          <Row className="m-0">
            <Column align="left">
              <Text
                className="m-0 font-bold"
                style={{ fontSize: "16px", lineHeight: "24px" }}
              >
                Driver Information
              </Text>
            </Column>
            <Column align="right">
              <table cellPadding={0} cellSpacing={0} role="presentation">
                <tr>
                  <td
                    className="rounded-full bg-[#E4E4E4]"
                    style={{ padding: "4px 12px" }}
                  >
                    <Text
                      className="m-0"
                      style={{
                        fontSize: "12px",
                        lineHeight: "16px",
                        color: "#22070B",
                      }}
                    >
                      {driverDetails ? "Confirmed" : "Pending"}
                    </Text>
                  </td>
                </tr>
              </table>
            </Column>
          </Row>

          {[
            { label: "Vehicle ID", value: driverDetails?.vehicleId },
            { label: "License Plate", value: driverDetails?.licensePlate },
            { label: "Description", value: driverDetails?.description },
            { label: "Driver", value: driverDetails?.name },
          ].map((row) => (
            <Row key={row.label} className="m-0 mt-[16px]">
              <Column align="left">
                <Text
                  className="m-0"
                  style={{
                    fontSize: "14px",
                    lineHeight: "20px",
                    color: "#22070BB2",
                  }}
                >
                  {row.label}
                </Text>
              </Column>
              <Column align="right">
                <Text
                  className="m-0"
                  style={{ fontSize: "14px", lineHeight: "20px" }}
                >
                  {row.value ?? "--"}
                </Text>
              </Column>
            </Row>
          ))}
        </Section>

        <Img
          alt="Map with pickup and dropoff locations"
          className="rounded-[8px] my-[16px] mx-auto border border-solid border-[#22070B26]"
          width={300}
          height={300}
        />

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
                  Edit ride
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
                  Chat with driver
                </Button>
              </td>
            </Row>
          </Column>
        </Row>
      </Tailwind>
    </Html>
  );
}

RideConfirmationEmail.PreviewProps = {
  name: "Bob",
  date: "Today, March 6",
  dropoffTime: "2:45 PM",
  pickupTime: "2:30 PM",
  pickupLocation: "Exhibition Hall",
  destination: "Tech Square Eastbound",
};
