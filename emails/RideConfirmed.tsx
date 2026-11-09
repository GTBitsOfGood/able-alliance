import RideEmail, { type RideEmailProps } from "./_components/RideEmail";
import { ridePreview } from "./_components/preview";

export default function RideConfirmationEmail(props: RideEmailProps) {
  return (
    <RideEmail
      {...props}
      heading={`${props.name}, here are your ride details`}
      actionLabel="Edit ride"
    />
  );
}

RideConfirmationEmail.PreviewProps = ridePreview;
