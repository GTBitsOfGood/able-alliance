import RideEmail, { type RideEmailProps } from "./_components/RideEmail";
import { ridePreview } from "./_components/preview";

type Props = Omit<RideEmailProps, "pickupTime" | "dropoffTime"> & {
  oldPickupTime: string;
  newPickupTime: string;
  oldDropoffTime: string;
  newDropoffTime: string;
  delay: string;
};

export default function RideDelayedEmail({
  newPickupTime,
  newDropoffTime,
  delay,
  ...props
}: Props) {
  return (
    <RideEmail
      {...props}
      heading={`${props.name}, your ride has been delayed by ${delay}`}
      pickupTime={newPickupTime}
      dropoffTime={newDropoffTime}
      actionLabel="Edit ride"
    />
  );
}

RideDelayedEmail.PreviewProps = {
  ...ridePreview,
  delay: "15 minutes",
  oldPickupTime: "2:30 PM",
  newPickupTime: "2:45 PM",
  oldDropoffTime: "2:45 PM",
  newDropoffTime: "3:00 PM",
} satisfies Props;
