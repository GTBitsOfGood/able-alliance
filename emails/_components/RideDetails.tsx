import { Section, Row, Column, Text, Hr } from "react-email";

export type RideDetailsProps = {
  date: string;
  pickupTime: string;
  dropoffTime: string;
  pickupLocation: string;
  destination: string;
  oldPickupTime?: string;
  oldDropoffTime?: string;
};

export default function RideDetails({
  date,
  pickupTime,
  dropoffTime,
  pickupLocation,
  destination,
  oldPickupTime,
  oldDropoffTime,
}: RideDetailsProps) {
  return (
    <Section className="border border-solid border-[#DEDADB] p-[16px] mb-[16px]">
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
              color: oldPickupTime || oldDropoffTime ? "#C73A3A" : undefined,
            }}
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
            style={{
              fontSize: "18px",
              lineHeight: "24px",
              color: oldPickupTime || oldDropoffTime ? "#C73A3A" : undefined,
            }}
          >
            {dropoffTime}
          </Text>
        </Column>
      </Row>

      {(oldPickupTime || oldDropoffTime) && (
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
      )}

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
  );
}
