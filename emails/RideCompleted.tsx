import RideEmail, { type RideEmailProps } from "./_components/RideEmail";
import { ridePreview } from "./_components/preview";
import { Text } from "react-email";

export default function RideCompletedEmail(props: RideEmailProps) {
  return (
    <RideEmail
      {...props}
      heading={`${props.name}, thank you for riding with GT Paratransit`}
      showDriver={false}
      chatUrl={undefined}
    >
      <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
        Your ride is complete. We hope to see you again soon!
      </Text>
    </RideEmail>
  );
}

RideCompletedEmail.PreviewProps = ridePreview;
