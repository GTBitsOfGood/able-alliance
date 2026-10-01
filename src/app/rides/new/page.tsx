"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWindowSize } from "react-use";
import { fromZonedTime } from "date-fns-tz";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TimeInput } from "@/components/TimeInput/TimeInput";
import { SearchableSelect } from "@/components/SearchableSelect/SearchableSelect";
import BogIcon from "@/components/BogIcon/BogIcon";
import styles from "./styles.module.css";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Location = {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
};

function PickupWindowErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.257 3.099C9.022 1.739 10.979 1.739 11.743 3.099L17.323 13.019C18.073 14.353 17.11 15.999 15.581 15.999H4.42C2.89 15.999 1.927 14.353 2.677 13.019L8.257 3.099ZM11 13C11 13.2652 10.8946 13.5196 10.7071 13.7071C10.5196 13.8946 10.2652 14 10 14C9.73478 14 9.48043 13.8946 9.29289 13.7071C9.10536 13.5196 9 13.2652 9 13C9 12.7348 9.10536 12.4804 9.29289 12.2929C9.48043 12.1054 9.73478 12 10 12C10.2652 12 10.5196 12.1054 10.7071 12.2929C10.8946 12.4804 11 12.7348 11 13ZM10 5C9.73478 5 9.48043 5.10536 9.29289 5.29289C9.10536 5.48043 9 5.73478 9 6V9C9 9.26522 9.10536 9.51957 9.29289 9.70711C9.48043 9.89464 9.73478 10 10 10C10.2652 10 10.5196 9.89464 10.7071 9.70711C10.8946 9.51957 11 9.26522 11 9V6C11 5.73478 10.8946 5.48043 10.7071 5.29289C10.5196 5.10536 10.2652 5 10 5Z"
        fill="currentColor"
      />
    </svg>
  );
}

const SERVICE_START_TIME = "07:30";
const SERVICE_END_TIME = "19:45";

function isServiceDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

export default function CreateRidePage() {
  const router = useRouter();
  const { width: windowWidth } = useWindowSize();
  const isMobileLayout = windowWidth <= 900;
  const isMobileLayoutRef = useRef(isMobileLayout);
  useEffect(() => {
    isMobileLayoutRef.current = isMobileLayout;
  }, [isMobileLayout]);

  function scrollFieldIntoView(e: React.FocusEvent<HTMLElement>) {
    if (!isMobileLayout) return;
    e.target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [pickupLocationName, setPickupLocationName] = useState("");
  const [dropoffLocationName, setDropoffLocationName] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [pickupTime, setPickupTime] = useState("13:00");
  const [pickupWindowFromTime, setPickupWindowFromTime] = useState("12:10");
  const [pickupWindowToTime, setPickupWindowToTime] = useState("12:45");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [pickupWindowErrorField, setPickupWindowErrorField] = useState<
    "from" | "to" | null
  >(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const focusSelectedLocationsRef = useRef<
    (map: mapboxgl.Map, duration: number) => void
  >(() => {});
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
  const dotMarkerRefs = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (error) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [error]);

  useEffect(() => {
    async function fetchLocations() {
      try {
        const res = await fetch("/api/locations");
        if (!res.ok) throw new Error("Failed to fetch locations");
        const data = (await res.json()) as Location[];
        setLocations(data);

        if (!isMobileLayoutRef.current) {
          if (data.length > 0) {
            setPickupLocationName(data[0].name);
          }
          if (data.length > 1) {
            setDropoffLocationName(data[1].name);
          } else if (data.length > 0) {
            setDropoffLocationName(data[0].name);
          }
        }

        if (data.length === 0) {
          setError("No locations available. Please contact an administrator.");
        }
      } catch (e) {
        setError(
          "Unable to load locations. " +
            (e instanceof Error ? e.message : "Unknown error"),
        );
      } finally {
        setLoading(false);
      }
    }

    fetchLocations();
  }, []);

  useEffect(() => {
    try {
      if (loading) return;

      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const container = mapContainerRef.current;
      if (!container || !token) return;

      const defaultCenter: [number, number] = [-84.3988077, 33.7760948];
      const defaultZoom = 15;

      const pickup = locations.find((l) => l.name === pickupLocationName);
      const dropoff = locations.find((l) => l.name === dropoffLocationName);

      const center = (): [number, number] => {
        if (pickup && dropoff) {
          return [
            (pickup.longitude + dropoff.longitude) / 2,
            (pickup.latitude + dropoff.latitude) / 2,
          ];
        }
        if (pickup) return [pickup.longitude, pickup.latitude];
        if (dropoff) return [dropoff.longitude, dropoff.latitude];
        return defaultCenter;
      };

      const focusSelectedLocations = (map: mapboxgl.Map, duration: number) => {
        if (pickup && dropoff) {
          const pickupCoordinates: [number, number] = [
            pickup.longitude,
            pickup.latitude,
          ];
          const dropoffCoordinates: [number, number] = [
            dropoff.longitude,
            dropoff.latitude,
          ];
          const sameLocation =
            Math.abs(pickup.longitude - dropoff.longitude) < 0.0003 &&
            Math.abs(pickup.latitude - dropoff.latitude) < 0.0003;

          if (!sameLocation) {
            const bounds = new mapboxgl.LngLatBounds(
              pickupCoordinates,
              pickupCoordinates,
            );
            bounds.extend(dropoffCoordinates);
            map.fitBounds(bounds, {
              padding: 64,
              maxZoom: defaultZoom,
              duration,
            });
            return;
          }
        }

        map.flyTo({
          center: center(),
          zoom: defaultZoom,
          duration,
        });
      };
      focusSelectedLocationsRef.current = focusSelectedLocations;

      mapboxgl.accessToken = token;
      if (!mapRef.current) {
        mapRef.current = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/streets-v12",
          center: center(),
          zoom: defaultZoom,
        });
        mapRef.current.on("load", () => {
          if (!mapRef.current) return;
          mapRef.current.resize();
          focusSelectedLocationsRef.current(mapRef.current, 0);
        });
      } else if (mapRef.current.loaded()) {
        focusSelectedLocations(mapRef.current, 700);
      }

      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      dotMarkerRefs.current.forEach((marker) => marker.remove());
      dotMarkerRefs.current = [];

      const createCustomPin = (
        labelText: string,
        extraStemPx = 0,
      ): HTMLDivElement => {
        const root = document.createElement("div");
        root.className = styles.mapPinRoot;

        const label = document.createElement("div");
        label.textContent = labelText;
        label.className = styles.mapPinLabel;

        const stem = document.createElement("div");
        stem.className = styles.mapPinStem;
        if (extraStemPx > 0) {
          stem.style.height = `calc(2.2rem + ${extraStemPx}px)`;
        }

        const dot = document.createElement("div");
        dot.className = styles.mapPinDot;

        root.appendChild(label);
        root.appendChild(stem);
        root.appendChild(dot);
        return root;
      };

      const createLocationDot = (name: string): HTMLDivElement => {
        const wrapper = document.createElement("div");
        wrapper.className = styles.mapLocationDotWrapper;

        const tooltip = document.createElement("div");
        tooltip.className = styles.mapDotTooltip;
        tooltip.textContent = name;

        const dot = document.createElement("div");
        dot.className = styles.mapLocationDot;

        wrapper.appendChild(tooltip);
        wrapper.appendChild(dot);
        return wrapper;
      };

      const pickupLngLat: [number, number] | null = pickup
        ? [pickup.longitude, pickup.latitude]
        : null;
      const dropoffLngLat: [number, number] | null = dropoff
        ? [dropoff.longitude, dropoff.latitude]
        : null;
      const overlap =
        pickupLngLat !== null &&
        dropoffLngLat !== null &&
        Math.abs(pickupLngLat[0] - dropoffLngLat[0]) < 0.0003 &&
        Math.abs(pickupLngLat[1] - dropoffLngLat[1]) < 0.0003;

      // Add a dot for every non-selected campus location.
      for (const loc of locations) {
        const isPickup = loc.name === pickupLocationName;
        const isDropoff = loc.name === dropoffLocationName;
        if (!isPickup && !isDropoff) {
          const dotMarker = new mapboxgl.Marker({
            element: createLocationDot(loc.name),
            anchor: "center",
          })
            .setLngLat([loc.longitude, loc.latitude])
            .addTo(mapRef.current);
          dotMarkerRefs.current.push(dotMarker);
        }
      }

      if (pickup && pickupLngLat) {
        const pickupMarker = new mapboxgl.Marker({
          element: createCustomPin(`Pickup: ${pickup.name}`),
          anchor: "bottom",
        })
          .setLngLat(pickupLngLat)
          .addTo(mapRef.current);
        markerRefs.current.push(pickupMarker);
      }

      if (dropoff && dropoffLngLat) {
        // Raise dropoff pin above pickup when they share the same location
        const dropoffMarker = new mapboxgl.Marker({
          element: createCustomPin(
            `Dropoff: ${dropoff.name}`,
            overlap ? 50 : 0,
          ),
          anchor: "bottom",
        })
          .setLngLat(dropoffLngLat)
          .addTo(mapRef.current);
        markerRefs.current.push(dropoffMarker);
      }
    } catch (e) {
      // Surface failures from the external map API to the user.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(
        "Unable to load map. " +
          (e instanceof Error ? e.message : "Unknown error"),
      );
    }
  }, [loading, locations, pickupLocationName, dropoffLocationName]);

  useEffect(() => {
    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      dotMarkerRefs.current.forEach((marker) => marker.remove());
      dotMarkerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const locationNames = locations.map((l) => l.name);
  const locationOptions = locationNames.map((name) => ({
    value: name,
    label: name,
  }));
  const nameToId = locations.reduce(
    (acc, loc) => {
      acc[loc.name] = loc._id;
      return acc;
    },
    {} as Record<string, string>,
  );

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth };
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPickupWindowErrorField(null);

    const pickupId = nameToId[pickupLocationName];
    const dropoffId = nameToId[dropoffLocationName];

    if (!pickupId || !dropoffId) {
      setError("Please select both pickup and drop-off locations.");
      return;
    }

    if (pickupId === dropoffId) {
      setError("Pickup and drop-off locations must be different.");
      return;
    }

    if (!selectedDate) {
      setError("Please select a ride date.");
      return;
    }

    if (!isServiceDay(selectedDate)) {
      setError("Ride dates must be Monday through Friday.");
      return;
    }

    if (!pickupWindowFromTime || !pickupWindowToTime) {
      setError("Please provide both pickup window start and end times.");
      return;
    }

    const requestedTimes = [
      pickupTime,
      pickupWindowFromTime,
      pickupWindowToTime,
    ];
    if (
      requestedTimes.some(
        (time) => time < SERVICE_START_TIME || time > SERVICE_END_TIME,
      )
    ) {
      setError("Pickup time and window must be within service hours.");
      return;
    }

    // Build UTC timestamps treating the user-selected date/time as America/New_York
    const toEstUtc = (date: Date, timeStr: string): Date => {
      const [h, m] = timeStr.split(":").map(Number);
      return fromZonedTime(
        new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0),
        "America/New_York",
      );
    };

    const [hours, minutes] = pickupTime.split(":").map(Number);
    const scheduledPickupTime = toEstUtc(
      selectedDate,
      `${hours}:${minutes}`,
    ).toISOString();

    const [windowStartHours, windowStartMinutes] = pickupWindowFromTime
      .split(":")
      .map(Number);
    const [windowEndHours, windowEndMinutes] = pickupWindowToTime
      .split(":")
      .map(Number);
    const pickupWindowStart = toEstUtc(
      selectedDate,
      `${windowStartHours}:${windowStartMinutes}`,
    );
    const pickupWindowEnd = toEstUtc(
      selectedDate,
      `${windowEndHours}:${windowEndMinutes}`,
    );

    if (pickupWindowEnd <= pickupWindowStart) {
      setError("Pickup window end time must be after start time.");
      return;
    }

    const scheduledPickupDate = toEstUtc(selectedDate, `${hours}:${minutes}`);
    if (
      scheduledPickupDate < pickupWindowStart ||
      scheduledPickupDate > pickupWindowEnd
    ) {
      setPickupWindowErrorField(
        scheduledPickupDate < pickupWindowStart ? "from" : "to",
      );
      setError(
        isMobileLayout
          ? "Ensure Pickup Time is within the Pickup Time Window."
          : "Pickup time must fall within the pickup time window.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupLocation: pickupId,
          dropoffLocation: dropoffId,
          scheduledPickupTime,
          pickupWindowStart: pickupWindowStart.toISOString(),
          pickupWindowEnd: pickupWindowEnd.toISOString(),
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(
          errData.error || `Failed to create ride (${res.status})`,
        );
      }

      router.push("/rides");
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <p>Loading...</p>
        </main>
      </div>
    );
  }

  const { firstDay, daysInMonth } = getDaysInMonth(currentMonth);
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className={styles.dateEmpty} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const isSelected = selectedDate?.toDateString() === date.toDateString();
    const isToday = new Date().toDateString() === date.toDateString();
    const isAvailable = isServiceDay(date);

    days.push(
      <button
        key={day}
        type="button"
        className={`${styles.dateCell} ${isSelected ? styles.dateSelected : ""} ${isToday ? styles.dateToday : ""}`}
        onClick={() => setSelectedDate(date)}
        disabled={!isAvailable}
        title={isAvailable ? undefined : "Service is available Monday–Friday"}
      >
        {day}
      </button>,
    );
  }

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.errorBanner} role="alert">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className={styles.errorBannerIcon}
          >
            <circle
              cx="10"
              cy="10"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M10 6v5M10 13.5h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Error: {error}
        </div>
      )}
      <main className={styles.main}>
        <Link href="/rides" className={styles.backButton}>
          ← Back to rides
        </Link>

        <h1 className={styles.pageTitle}>Request Ride</h1>

        <div className={styles.rideDetailsSection}>
          <form onSubmit={handleSubmit} className={styles.rideForm}>
            <div className={styles.rideDetailsOutline}>
              {/* Left Column */}
              <div className={styles.leftColumn}>
                {/* Ride Date */}
                <div className={`${styles.formGroup} ${styles.rideDateGroup}`}>
                  <h2 className={styles.formGroupTitle}>Ride Date</h2>
                  <div className={styles.datePicker}>
                    <div className={styles.calendarHeader}>
                      <button
                        type="button"
                        aria-label="Previous month"
                        onClick={prevMonth}
                        className={styles.calendarNav}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M15 18L9 12L15 6"
                            stroke="#5B9BD5"
                            strokeWidth="2"
                          />
                        </svg>
                      </button>
                      <div className={styles.calendarMonth}>
                        <span className={styles.monthName}>
                          {monthNames[currentMonth.getMonth()]}
                        </span>
                        <span className={styles.yearName}>
                          {currentMonth.getFullYear()}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label="Next month"
                        onClick={nextMonth}
                        className={styles.calendarNav}
                      >
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M9 18L15 12L9 6"
                            stroke="#5B9BD5"
                            strokeWidth="2"
                          />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.calendarGrid}>
                      <div className={styles.weekDays}>
                        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                          <div key={d} className={styles.weekDay}>
                            {d}
                          </div>
                        ))}
                      </div>
                      <div className={styles.datesGrid}>{days}</div>
                    </div>
                  </div>
                </div>

                {/* Pickup Time */}
                <div className={styles.formGroup}>
                  <h2 className={styles.formGroupTitle}>Pickup Time</h2>
                  <p className={styles.fieldDescription}>
                    {isMobileLayout
                      ? "Enter the exact time that you'd like to be picked up."
                      : "Please enter the exact time that you'd like to be picked up."}
                  </p>
                  <div
                    className={styles.timeCell}
                    onFocusCapture={scrollFieldIntoView}
                  >
                    <TimeInput
                      value={pickupTime}
                      onChange={setPickupTime}
                      min={SERVICE_START_TIME}
                      max={SERVICE_END_TIME}
                      inputClassName={styles.timeInput}
                      className={styles.timeInputWrapper}
                    />
                  </div>
                </div>

                {/* Pickup Time Window */}
                <div className={styles.formGroup}>
                  <h2 className={styles.formGroupTitle}>Pickup Time Window</h2>
                  <p
                    className={`${styles.fieldDescription} ${pickupWindowErrorField ? styles.fieldDescriptionError : ""}`}
                  >
                    {isMobileLayout
                      ? "Ensure that your pickup time is within the pickup time window. This is used to determine ride flexibility."
                      : "(E.g. 12:15 PM - 12:45 PM)"}
                  </p>
                  <div className={styles.pickupWindowRow}>
                    <div className={styles.pickupWindowField}>
                      <label
                        className={styles.pickupWindowLabel}
                        htmlFor="pickup-window-from"
                      >
                        From
                      </label>
                      <div
                        className={`${styles.pickupWindowCell} ${pickupWindowErrorField === "from" ? styles.pickupWindowCellError : ""}`}
                        onFocusCapture={scrollFieldIntoView}
                      >
                        <TimeInput
                          id="pickup-window-from"
                          value={pickupWindowFromTime}
                          onChange={setPickupWindowFromTime}
                          min={SERVICE_START_TIME}
                          max={SERVICE_END_TIME}
                          inputClassName={styles.pickupWindowInput}
                          className={styles.pickupWindowInputWrapper}
                        />
                        {pickupWindowErrorField === "from" && (
                          <PickupWindowErrorIcon
                            className={styles.pickupWindowErrorIcon}
                          />
                        )}
                      </div>
                    </div>
                    <div className={styles.pickupWindowField}>
                      <label
                        className={styles.pickupWindowLabel}
                        htmlFor="pickup-window-to"
                      >
                        To
                      </label>
                      <div
                        className={`${styles.pickupWindowCell} ${pickupWindowErrorField === "to" ? styles.pickupWindowCellError : ""}`}
                        onFocusCapture={scrollFieldIntoView}
                      >
                        <TimeInput
                          id="pickup-window-to"
                          value={pickupWindowToTime}
                          onChange={setPickupWindowToTime}
                          min={SERVICE_START_TIME}
                          max={SERVICE_END_TIME}
                          inputClassName={styles.pickupWindowInput}
                          className={styles.pickupWindowInputWrapper}
                        />
                        {pickupWindowErrorField === "to" && (
                          <PickupWindowErrorIcon
                            className={styles.pickupWindowErrorIcon}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recurring Ride */}
                {isMobileLayout && (
                  <div
                    className={styles.formGroup}
                    title="Recurring rides are coming soon"
                  >
                    <label className={styles.recurringCheckboxRow}>
                      <input
                        type="checkbox"
                        disabled
                        className={styles.recurringCheckbox}
                      />
                      Recurring ride (optional)
                    </label>
                    <div className={styles.recurringFrequencyCell}>
                      <select
                        defaultValue="weekly"
                        disabled
                        className={styles.recurringFrequencySelect}
                        aria-label="Recurring ride frequency"
                      >
                        <option value="weekly">Every Week</option>
                      </select>
                      <BogIcon
                        name="chevron-down"
                        size={16}
                        className={styles.recurringFrequencyChevron}
                      />
                    </div>
                  </div>
                )}
                {/* Recurring rides - TBD on implementation */}
                <div
                  className={`${styles.recurringRide} ${styles.desktopRecurringRide}`}
                  title="Recurring rides are coming soon"
                >
                  <label className={styles.recurringRideLabel}>
                    <input
                      type="checkbox"
                      className={styles.recurringRideCheckbox}
                      disabled
                    />
                    Recurring ride
                  </label>
                  <select
                    className={styles.recurringRideSelect}
                    defaultValue="weekly"
                    disabled
                    aria-label="Recurring ride frequency"
                  >
                    <option value="weekly">Every Week</option>
                  </select>
                </div>
              </div>

              {/* Column Divider */}
              <div className={styles.columnDivider} aria-hidden />

              {/* Right Column */}
              <div className={styles.rightColumn}>
                {/* Map */}
                <div ref={mapContainerRef} className={styles.mapImage} />

                {/* Pickup Location */}
                <div className={styles.formGroup}>
                  <h2 className={styles.formGroupTitle}>Pickup Location</h2>
                  <p className={styles.fieldDescription}>
                    Type or locate on the map the{" "}
                    <strong>on campus location</strong> that you&apos;d like to
                    be picked up at.
                  </p>
                  <div className={styles.locationCell}>
                    <svg
                      width="16"
                      height="20"
                      viewBox="0 0 16 20"
                      fill="none"
                      className={styles.locationIcon}
                    >
                      <path
                        d="M8 0C3.58 0 0 3.58 0 8c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8Z"
                        className={styles.locationIconFill}
                      />
                      <circle
                        cx="8"
                        cy="8"
                        r="3"
                        className={styles.locationIconCenter}
                      />
                    </svg>
                    {isMobileLayout ? (
                      <SearchableSelect
                        id="pickup-location"
                        aria-label="Pickup location"
                        value={pickupLocationName}
                        onChange={setPickupLocationName}
                        options={locationOptions}
                        placeholder="Enter pickup location"
                        className={styles.locationSelectWrapper}
                        inputClassName={styles.locationTextInput}
                        onFocusCapture={scrollFieldIntoView}
                        required
                      />
                    ) : (
                      <select
                        id="pickup-location"
                        aria-label="Pickup location"
                        value={pickupLocationName}
                        onChange={(e) => setPickupLocationName(e.target.value)}
                        className={styles.locationSelect}
                        required
                      >
                        {!pickupLocationName && (
                          <option value="" disabled>
                            Select pickup location...
                          </option>
                        )}
                        {locationNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Dropoff Location */}
                <div className={styles.formGroup}>
                  <h2 className={styles.formGroupTitle}>Dropoff Location</h2>
                  <p className={styles.fieldDescription}>
                    Type or locate on the map the{" "}
                    <strong>on campus location</strong> that you&apos;d like to
                    be dropped off at.
                  </p>
                  <div className={styles.locationCell}>
                    <svg
                      width="16"
                      height="20"
                      viewBox="0 0 16 20"
                      fill="none"
                      className={styles.locationIconGreen}
                    >
                      <path
                        d="M8 0C3.58 0 0 3.58 0 8c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8Z"
                        className={styles.locationIconFill}
                      />
                      <circle
                        cx="8"
                        cy="8"
                        r="3"
                        className={styles.locationIconCenter}
                      />
                    </svg>
                    {isMobileLayout ? (
                      <SearchableSelect
                        id="dropoff-location"
                        aria-label="Dropoff location"
                        value={dropoffLocationName}
                        onChange={setDropoffLocationName}
                        options={locationOptions}
                        placeholder="Enter dropoff location"
                        className={styles.locationSelectWrapper}
                        inputClassName={styles.locationTextInput}
                        onFocusCapture={scrollFieldIntoView}
                        required
                      />
                    ) : (
                      <select
                        id="dropoff-location"
                        aria-label="Dropoff location"
                        value={dropoffLocationName}
                        onChange={(e) => setDropoffLocationName(e.target.value)}
                        className={styles.locationSelect}
                        required
                      >
                        {!dropoffLocationName && (
                          <option value="" disabled>
                            Select drop-off location...
                          </option>
                        )}
                        {locationNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {isMobileLayout ? (
                  <div className={styles.submitSection}>
                    <p className={styles.rideCountText}>
                      You are requesting <strong>1</strong> ride(s).
                    </p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className={styles.submitButton}
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                ) : (
                  <div className={styles.submitRow}>
                    <button
                      type="submit"
                      disabled={submitting}
                      className={styles.submitButton}
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
