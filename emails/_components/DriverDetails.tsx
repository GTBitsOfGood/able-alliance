import { Section, Row, Column, Text } from "react-email";

export type DriverDetailsProps = {
  name: string;
  vehicleId: string;
  licensePlate: string;
  description?: string;
};

export default function DriverDetails({
  driverDetails,
}: {
  driverDetails?: DriverDetailsProps;
}) {
  return (
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
  );
}
