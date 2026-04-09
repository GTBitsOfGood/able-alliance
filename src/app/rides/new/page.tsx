"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { TimeInput } from "@/components/TimeInput/TimeInput";
import styles from "./styles.module.css";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type Location = {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export default function CreateRidePage() {
  const router = useRouter();
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

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);

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

        if (data.length > 0) {
          setPickupLocationName(data[0].name);
        }
        if (data.length > 1) {
          setDropoffLocationName(data[1].name);
        } else if (data.length > 0) {
          setDropoffLocationName(data[0].name);
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

      const createCustomPin = (
        labelText: string,
        color: string,
      ): HTMLDivElement => {
        const root = document.createElement("div");
        root.className = styles.mapPinRoot;
        root.style.setProperty("--pin-color", color);

        const label = document.createElement("div");
        label.textContent = labelText;
        label.className = styles.mapPinLabel;

        const stem = document.createElement("div");
        stem.className = styles.mapPinStem;

        const dot = document.createElement("div");
        dot.className = styles.mapPinDot;

        root.appendChild(label);
        root.appendChild(stem);
        root.appendChild(dot);
        return root;
      };

      if (pickup) {
        const pickupMarker = new mapboxgl.Marker({
          element: createCustomPin("Pickup", "var(--color-status-blue-text)"),
          anchor: "bottom",
        })
          .setLngLat([pickup.longitude, pickup.latitude])
          .addTo(mapRef.current);
        markerRefs.current.push(pickupMarker);
      }

      if (dropoff) {
        const dropoffMarker = new mapboxgl.Marker({
          element: createCustomPin("Dropoff", "var(--color-status-blue-text)"),
          anchor: "bottom",
        })
          .setLngLat([dropoff.longitude, dropoff.latitude])
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
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const locationNames = locations.map((l) => l.name);
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

    const [hours, minutes] = pickupTime.split(":").map(Number);
    const scheduledPickupTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hours,
      minutes,
      0,
    ).toISOString();

    const [windowStartHours, windowStartMinutes] = pickupWindowFromTime
      .split(":")
      .map(Number);
    const [windowEndHours, windowEndMinutes] = pickupWindowToTime
      .split(":")
      .map(Number);
    const pickupWindowStart = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      windowStartHours,
      windowStartMinutes,
      0,
    );
    const pickupWindowEnd = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      windowEndHours,
      windowEndMinutes,
      0,
    );

    if (pickupWindowEnd <= pickupWindowStart) {
      setError("Pickup window end time must be after start time.");
      return;
    }

    const scheduledPickupDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hours,
      minutes,
      0,
    );
    if (
      scheduledPickupDate < pickupWindowStart ||
      scheduledPickupDate > pickupWindowEnd
    ) {
      setError("Pickup time must fall within the pickup time window.");
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
            <circle cx="10" cy="10" r="9" stroke="#c73a3a" strokeWidth="2" />
            <path
              d="M10 6v5M10 13.5h.01"
              stroke="#c73a3a"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Error: {error}
        </div>
      )}
      <main className={styles.main}>
        <Link href="/rides" className={styles.backButton}>
          ← Back to Rides
        </Link>

        <h1 className={styles.pageTitle}>Create Ride</h1>

        <div className={styles.rideDetailsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Ride Details</h2>
            <p className={styles.sectionDescription}>
              Please enter your desired ride information accordingly.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.rideDetailsOutline}>
              {/* Left Column */}
              <div className={styles.leftColumn}>
                {/* Ride Date */}
                <div className={styles.formGroup}>
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
                    <p className={styles.calendarHint}>Pick a day.</p>
                  </div>
                </div>

                {/* Pickup Time */}
                <div className={styles.formGroup}>
                  <h3 className={styles.formGroupTitle}>
                    Pickup Time<span className={styles.required}>*</span>
                  </h3>
                  <p className={styles.fieldDescription}>
                    Please enter the exact time that you&apos;d like to be
                    picked up.
                  </p>
                  <div className={styles.timeCell}>
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
                  <p className={styles.fieldDescription}>
                    (E.g. 12:15 PM - 12:45 PM)
                  </p>
                  <div className={styles.pickupWindowRow}>
                    <div className={styles.pickupWindowField}>
                      <label
                        className={styles.pickupWindowLabel}
                        htmlFor="pickup-window-from"
                      >
                        From
                      </label>
                      <div className={styles.pickupWindowCell}>
                        <TimeInput
                          id="pickup-window-from"
                          value={pickupWindowFromTime}
                          onChange={setPickupWindowFromTime}
                          inputClassName={styles.pickupWindowInput}
                          className={styles.pickupWindowInputWrapper}
                        />
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
                      <div className={styles.pickupWindowCell}>
                        <TimeInput
                          id="pickup-window-to"
                          value={pickupWindowToTime}
                          onChange={setPickupWindowToTime}
                          inputClassName={styles.pickupWindowInput}
                          className={styles.pickupWindowInputWrapper}
                        />
                      </div>
                    </div>
                  </div>
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
                  <h3 className={styles.formGroupTitle}>
                    Pickup Location<span className={styles.required}>*</span>
                  </h3>
                  <p className={styles.fieldDescription}>
                    Please type or locate on the above map the{" "}
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
                        d="M8 10C9.1 10 10 9.1 10 8C10 6.9 9.1 6 8 6C6.9 6 6 6.9 6 8C6 9.1 6.9 10 8 10ZM8 0C3.6 0 0 3.6 0 8C0 12.9 8 20 8 20C8 20 16 12.9 16 8C16 3.6 12.4 0 8 0Z"
                        fill="#325CE8"
                      />
                    </svg>
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
                  </div>
                </div>

                {/* Dropoff Location */}
                <div className={styles.formGroup}>
                  <h3 className={styles.formGroupTitle}>
                    Dropoff Location<span className={styles.required}>*</span>
                  </h3>
                  <p className={styles.fieldDescription}>
                    Please type or locate on the above map the{" "}
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
                        d="M8 10C9.1 10 10 9.1 10 8C10 6.9 9.1 6 8 6C6.9 6 6 6.9 6 8C6 9.1 6.9 10 8 10ZM8 0C3.6 0 0 3.6 0 8C0 12.9 8 20 8 20C8 20 16 12.9 16 8C16 3.6 12.4 0 8 0Z"
                        fill="#3aaa5c"
                      />
                    </svg>
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
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className={styles.submitButton}
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
