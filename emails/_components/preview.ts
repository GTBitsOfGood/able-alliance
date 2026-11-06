import type { RideEmailProps } from "./RideEmail";

export const ridePreview = {
  name: "Bob",
  date: "Thursday, July 30",
  pickupTime: "2:30 PM",
  dropoffTime: "2:45 PM",
  pickupLocation: "Exhibition Hall",
  destination: "Tech Square Eastbound",
  driverDetails: {
    name: "Alex Smith",
    vehicleId: "GT 12",
    licensePlate: "ABC1234",
    description: "White accessible van",
  },
  rideUrl: "https://paratransit.pts.gatech.edu/rides/example",
  chatUrl: "https://paratransit.pts.gatech.edu/rides/example?chat=1",
} satisfies RideEmailProps;
