import RideEmail, { type RideEmailProps } from "./_components/RideEmail";
import { ridePreview } from "./_components/preview";
import { Text } from "react-email";

type Props = RideEmailProps & { reason?: string };

export default function RideCancelledEmail({ reason, ...props }: Props) {
  return (
    <RideEmail
      {...props}
      heading={`${props.name}, your ride has been cancelled`}
      showDriver={false}
      chatUrl={undefined}
    >
      {reason && (
        <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
          Reason: {reason}
        </Text>
      )}
      <Text style={{ fontSize: "14px", lineHeight: "20px" }}>
        If you have any questions, please contact support.
      </Text>
    </RideEmail>
  );
}

RideCancelledEmail.PreviewProps = {
  ...ridePreview,
  reason: "Cancelled by the rider.",
} satisfies Props;
