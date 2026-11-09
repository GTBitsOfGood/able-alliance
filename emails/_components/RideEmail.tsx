import type { ReactNode } from "react";
import {
  Html,
  Head,
  Font,
  Tailwind,
  Heading,
  Row,
  Column,
  Button,
} from "react-email";
import RideDetails, { type RideDetailsProps } from "./RideDetails";
import DriverDetails, { type DriverDetailsProps } from "./DriverDetails";

export type RideEmailProps = RideDetailsProps & {
  name: string;
  driverDetails?: DriverDetailsProps;
  rideUrl: string;
  chatUrl?: string;
};

export default function RideEmail({
  heading,
  children,
  driverDetails,
  rideUrl,
  chatUrl,
  showDriver = true,
  actionLabel = "View ride details",
  ...ride
}: RideEmailProps & {
  heading: string;
  children?: ReactNode;
  showDriver?: boolean;
  actionLabel?: string;
}) {
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
        <Heading as="h3" style={{ fontSize: "20px", lineHeight: "28px" }}>
          {heading}
        </Heading>
        {children}
        <RideDetails {...ride} />
        {showDriver && <DriverDetails driverDetails={driverDetails} />}
        <Row>
          <Column align="center" className={chatUrl ? "w-1/2 pr-[16px]" : ""}>
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
              {actionLabel}
            </Button>
          </Column>
          {chatUrl && (
            <Column align="center" className="w-1/2">
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
            </Column>
          )}
        </Row>
      </Tailwind>
    </Html>
  );
}
