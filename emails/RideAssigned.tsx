import RideEmail, { type RideEmailProps } from "./_components/RideEmail";
import { ridePreview } from "./_components/preview";
import { Text } from "react-email";

export default function RideAssignedEmail(props: RideEmailProps) {
  return (
    <RideEmail
      {...props}
      heading={`${props.name}, you have been assigned a ride`}
      showDriver={false}
      chatUrl={undefined}
    >
      <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
        Review the pickup and dropoff details for your assigned ride.
      </Text>
    </RideEmail>
  );
}

RideAssignedEmail.PreviewProps = ridePreview;
