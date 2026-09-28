"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWindowSize } from "react-use";
import { fromZonedTime } from "date-fns-tz";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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

export default function CreateRidePage() {
  const router = useRouter();
  const { width: windowWidth } = useWindowSize();
  const isMobileLayout = windowWidth <= 900;
  const isMobileLayoutRef = useRef(isMobileLayout);
  isMobileLayoutRef.current = isMobileLayout;

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
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState("weekly");
  const [pickupWindowErrorField, setPickupWindowErrorField] = useState<
    "from" | "to" | null
  >(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
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
        const data = await res.json();
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

      mapboxgl.accessToken = token;
      if (!mapRef.current) {
        mapRef.current = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/streets-v12",
          center: center(),
          zoom: defaultZoom,
        });
        mapRef.current.on("load", () => mapRef.current?.resize());
      } else {
        mapRef.current.flyTo({ center: center(), zoom: defaultZoom });
      }

      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      dotMarkerRefs.current.forEach((marker) => marker.remove());
      dotMarkerRefs.current = [];

      const createCustomPin = (
        labelText: string,
        color: string,
        extraStemPx = 0,
      ): HTMLDivElement => {
        const root = document.createElement("div");
        root.className = styles.mapPinRoot;
        root.style.setProperty("--pin-color", color);

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

      const pinColor = "#183777";
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

      // Add blue dot markers for all non-selected locations
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
          element: createCustomPin(`Pickup: ${pickup.name}`, pinColor),
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
            pinColor,
            overlap ? 50 : 0,
          ),
          anchor: "bottom",
        })
          .setLngLat(dropoffLngLat)
          .addTo(mapRef.current);
        markerRefs.current.push(dropoffMarker);
      }
    } catch (e) {
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

    if (!pickupWindowFromTime || !pickupWindowToTime) {
      setError("Please provide both pickup window start and end times.");
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

    days.push(
      <button
        key={day}
        type="button"
        className={`${styles.dateCell} ${isSelected ? styles.dateSelected : ""} ${isToday ? styles.dateToday : ""}`}
        onClick={() => setSelectedDate(date)}
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
        <div className={styles.titleSection}>
          <Link href="/rides" className={styles.backButton}>
            ← Back to {isMobileLayout ? "rides" : "Rides"}
          </Link>

          <h1 className={styles.pageTitle}>
            {isMobileLayout ? "Request Ride" : "Create Ride"}
          </h1>
        </div>

        <div className={styles.rideDetailsSection}>
          {isMobileLayout ? null : (
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Ride Details</h2>
              <p className={styles.sectionDescription}>
                Please enter your desired ride information accordingly.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.rideDetailsOutline}>
              {/* Left Column */}
              <div className={styles.leftColumn}>
                {/* Ride Date */}
                <div className={`${styles.formGroup} ${styles.rideDateGroup}`}>
                  {isMobileLayout ? (
                    <h3 className={styles.formGroupTitle}>
                      Ride Date<span className={styles.required}>*</span>
                    </h3>
                  ) : (
                    <div className={styles.formGroupHeader}>
                      <h3 className={styles.formGroupTitle}>
                        Ride Date<span className={styles.required}>*</span>
                      </h3>
                      <Image
                        src="/calendar.svg"
                        alt="Calendar"
                        width={32}
                        height={32}
                        className={styles.calendarIcon}
                      />
                    </div>
                  )}
                  <div className={styles.datePicker}>
                    <div className={styles.calendarHeader}>
                      <button
                        type="button"
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
                    {isMobileLayout ? null : (
                      <p className={styles.calendarHint}>Pick a day.</p>
                    )}
                  </div>
                </div>

                {/* Pickup Time */}
                <div className={styles.formGroup}>
                  <h3 className={styles.formGroupTitle}>
                    Pickup Time<span className={styles.required}>*</span>
                  </h3>
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
                      inputClassName={styles.timeInput}
                      className={styles.timeInputWrapper}
                    />
                  </div>
                </div>

                {/* Pickup Time Window */}
                <div className={styles.formGroup}>
                  <h3 className={styles.formGroupTitle}>
                    Pickup Time Window<span className={styles.required}>*</span>
                  </h3>
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
                    <span className={styles.pickupWindowArrow}>→</span>
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
                  <div className={styles.formGroup}>
                    <label className={styles.recurringCheckboxRow}>
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className={styles.recurringCheckbox}
                      />
                      Recurring ride (optional)
                    </label>
                    <div className={styles.recurringFrequencyCell}>
                      <select
                        value={recurringFrequency}
                        onChange={(e) => setRecurringFrequency(e.target.value)}
                        disabled={!isRecurring}
                        className={styles.recurringFrequencySelect}
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
              </div>

              {/* Column Divider */}
              <div className={styles.columnDivider} aria-hidden />

              {/* Right Column */}
              <div className={styles.rightColumn}>
                {/* Map */}
                <div ref={mapContainerRef} className={styles.mapImage} />

                {/* Pickup Location */}
                <div className={styles.formGroup}>
                  <h3 className={styles.formGroupTitle}>
                    Pickup Location<span className={styles.required}>*</span>
                  </h3>
                  <p className={styles.fieldDescription}>
                    Please type or locate on the above map the{" "}
                    <strong>on campus location </strong> that you&apos;d like to
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
                        d="M8 10C9.1 10 10 9.1 10 8C10 6.9 9.1 6 8 6C6.9 6 6 6.9 6 8C6 9.1 6.9 10 8 10ZM8 0C3.6 0 0 3.6 0 8C0 12.9 8 20 8 20C8 20 16 12.9 16 8C16 3.6 12.4 0 8 0Z"
                        fill="#325CE8"
                      />
                    </svg>
                    {isMobileLayout ? (
                      <SearchableSelect
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
                  <h3 className={styles.formGroupTitle}>
                    Dropoff Location<span className={styles.required}>*</span>
                  </h3>
                  <p className={styles.fieldDescription}>
                    Please type or locate on the above map the{" "}
                    <strong>on campus location </strong> that you&apos;d like to
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
                        d="M8 10C9.1 10 10 9.1 10 8C10 6.9 9.1 6 8 6C6.9 6 6 6.9 6 8C6 9.1 6.9 10 8 10ZM8 0C3.6 0 0 3.6 0 8C0 12.9 8 20 8 20C8 20 16 12.9 16 8C16 3.6 12.4 0 8 0Z"
                        fill="#3aaa5c"
                      />
                    </svg>
                    {isMobileLayout ? (
                      <SearchableSelect
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
                  <button
                    type="submit"
                    disabled={submitting}
                    className={styles.submitButton}
                  >
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
