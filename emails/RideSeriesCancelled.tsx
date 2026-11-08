import RideDetails, { type RideDetailsProps } from "./_components/RideDetails";
import EmailButton from "./_components/EmailButton";
import { ridePreview } from "./_components/preview";
import { Html, Head, Font, Tailwind, Heading, Text } from "react-email";

type Props = {
  name: string;
  /** Every cancelled ride, in pickup order. */
  rides: RideDetailsProps[];
  reason?: string;
  /** False for drivers, whose rides are only those assigned to them. */
  scheduleStopped?: boolean;
  ridesUrl: string;
};

/** One email for a recurring series cancelled from a given ride onward. */
export default function RideSeriesCancelledEmail({
  name,
  rides,
  reason,
  scheduleStopped = true,
  ridesUrl,
}: Props) {
  const count = rides.length === 1 ? "1 ride" : `${rides.length} rides`;
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
          {scheduleStopped
            ? `${name}, your recurring rides have been cancelled`
            : `${name}, ${count} assigned to you ${rides.length === 1 ? "has" : "have"} been cancelled`}
        </Heading>
        <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
          {scheduleStopped
            ? `The recurring schedule has been stopped and the following ${count} ${rides.length === 1 ? "was" : "were"} cancelled.`
            : "A recurring ride series was cancelled. The following rides are no longer on your schedule."}
        </Text>
        {reason && (
          <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
            Reason: {reason}
          </Text>
        )}
        {rides.map((ride, index) => (
          <RideDetails key={index} {...ride} />
        ))}
        <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
          If you have any questions, please contact support.
        </Text>
        <EmailButton href={ridesUrl}>View your rides</EmailButton>
      </Tailwind>
    </Html>
  );
}

RideSeriesCancelledEmail.PreviewProps = {
  name: ridePreview.name,
  rides: [
    ridePreview,
    { ...ridePreview, date: "Thursday, August 6" },
    { ...ridePreview, date: "Thursday, August 13" },
  ],
  reason: "Cancelled by the rider.",
  ridesUrl: "https://paratransit.pts.gatech.edu/rides",
} satisfies Props;
