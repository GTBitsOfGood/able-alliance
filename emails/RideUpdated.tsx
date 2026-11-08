import RideEmail, { type RideEmailProps } from "./_components/RideEmail";
import { ridePreview } from "./_components/preview";
import { Text } from "react-email";

type Props = RideEmailProps & { message: string };

export default function RideUpdatedEmail({ message, ...props }: Props) {
  return (
    <RideEmail
      {...props}
      heading={`${props.name}, your ride assignment has been updated`}
      showDriver={false}
      chatUrl={undefined}
    >
      <Text style={{ fontSize: "14px", lineHeight: "20px" }}>{message}</Text>
    </RideEmail>
  );
}

RideUpdatedEmail.PreviewProps = {
  ...ridePreview,
  message:
    "The pickup time and vehicle have changed. Please review the updated details.",
} satisfies Props;
