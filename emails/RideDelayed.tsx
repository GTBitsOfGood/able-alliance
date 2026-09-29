import {
  Html,
  Text,
  Tailwind,
  Heading,
  Section,
  Row,
  Column,
  Head,
  Font,
  Button,
  Img,
  Hr,
} from "react-email";

type Props = {
  name: string;
  newDropoffTime: string;
  oldDropoffTime: string;
  oldPickupTime: string;
  newPickupTime: string;
  pickupLocation: string;
  destination: string;
  date: string;
  delay: string;
  driverDetails?: {
    name: string;
    vehicleId: string;
    licensePlate: string;
    description: string;
  };
  rideUrl: string;
  mapImgUrl?: string;
  chatUrl?: string;
};

export default function RideDelayedEmail({
  name,
  date,
  oldDropoffTime,
  newDropoffTime,
  oldPickupTime,
  newPickupTime,
  pickupLocation,
  destination,
  delay,
  driverDetails,
  rideUrl,
  mapImgUrl,
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
          {name}, your ride has been delayed by {delay}
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
                style={{
                  fontSize: "18px",
                  lineHeight: "24px",
                  color: "#C73A3A",
                }}
              >
                {newPickupTime}
              </Text>
            </Column>
            <Column className="w-1/3" align="center">
              <Hr className="border border-solid border-[#22070B26]" />
            </Column>
            <Column className="w-1/3" align="right">
              <Text
                className="m-0 font-bold"
                style={{
                  fontSize: "18px",
                  lineHeight: "24px",
                  color: "#C73A3A",
                }}
              >
                {newDropoffTime}
              </Text>
            </Column>
          </Row>

          <Row className="m-0 mt-[4px]">
            <Column className="w-1/2" align="left">
              <Text
                className="m-0"
                style={{
                  fontSize: "14px",
                  lineHeight: "24px",
                  textDecoration: "line-through",
                  color: "#22070BB2",
                }}
              >
                {oldPickupTime}
              </Text>
            </Column>
            <Column className="w-1/2" align="right">
              <Text
                className="m-0"
                style={{
                  fontSize: "14px",
                  lineHeight: "24px",
                  textDecoration: "line-through",
                  color: "#22070BB2",
                }}
              >
                {oldDropoffTime}
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
          src={mapImgUrl}
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
                  href={rideUrl}
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
                  href={chatUrl}
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

RideDelayedEmail.PreviewProps = {
  name: "Bob",
  delay: "15 minutes",
  date: "Today, March 6",
  oldDropoffTime: "2:45 PM",
  newDropoffTime: "3:00 PM",
  oldPickupTime: "2:30 PM",
  newPickupTime: "2:45 PM",
  pickupLocation: "Exhibition Hall",
  destination: "Tech Square Eastbound",
};
