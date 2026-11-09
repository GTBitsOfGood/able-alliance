import RideEmail, { type RideEmailProps } from "./_components/RideEmail";
import { ridePreview } from "./_components/preview";
import { Text } from "react-email";

export default function DriverEnRouteEmail(props: RideEmailProps) {
  return (
    <RideEmail {...props} heading={`${props.name}, your driver is on the way`}>
      <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
        Please be ready at your pickup location at {props.pickupTime}.
      </Text>
    </RideEmail>
  );
}

DriverEnRouteEmail.PreviewProps = ridePreview;
