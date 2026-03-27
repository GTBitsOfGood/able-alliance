"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./styles.module.css";

import mapboxgl from "mapbox-gl";
import 'mapbox-gl/dist/mapbox-gl.css'; 

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
    async function fetchLocations() {
      try {
        const res = await fetch("/api/locations");
        if (!res.ok) throw new Error("Failed to fetch locations");
        const data = await res.json();
        setLocations(data);

        // Set first two locations as defaults if available
        if (data.length > 0) {
          setPickupLocationName(data[0].name);
        }
        if (data.length > 1) {
          setDropoffLocationName(data[1].name);
        } else if (data.length > 0) {
          // If only one location available, set both to same (user can change)
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

      const defaultCenter: [number, number] = [-84.3988077, 33.7760948]; //middle of campus
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
          element: createCustomPin(`Pick Up: ${pickup.name}`, "#325CE8"),
          anchor: "bottom",
        })
          .setLngLat([pickup.longitude, pickup.latitude])
          .addTo(mapRef.current);
        markerRefs.current.push(pickupMarker);
      }

      if (dropoff) {
        const dropoffMarker = new mapboxgl.Marker({
          element: createCustomPin(`Drop Off: ${dropoff.name}`, "#C73A3A"),
          anchor: "bottom",
        })
          .setLngLat([dropoff.longitude, dropoff.latitude])
          .addTo(mapRef.current);
        markerRefs.current.push(dropoffMarker);
      }

    } catch (e) {
      setError(
        "Unable to load map. " + (e instanceof Error ? e.message : "Unknown error"),
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

    // Create ISO string from selected date and user-selected time
    const [hours, minutes] = pickupTime.split(":").map(Number);
    const scheduledPickupTime = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hours,
      minutes,
      0,
    ).toISOString();

    const [windowStartHours, windowStartMinutes] =
      pickupWindowFromTime.split(":").map(Number);
    const [windowEndHours, windowEndMinutes] =
      pickupWindowToTime.split(":").map(Number);
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

      // Success - redirect to /rides
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

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={`empty-${i}`} className={styles.dateEmpty}></div>);
  }

  // Add cells for each day of the month
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
      <main className={styles.main}>
        {/* Header with back button */}
        <div className={styles.header}>
          <Link href="/rides" className={styles.backButton}>
            ← Back to Rides
          </Link>
        </div>

        {/* Page Title */}
        <h1 className={styles.pageTitle}>Create Ride</h1>

        {/* Ride Details Section */}
        <div className={styles.rideDetailsSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionHeaderLeft}>
              <div className={styles.sectionTitleRow}>
                <h2 className={styles.sectionTitle}>Ride Details</h2>
                <button type="button" className={styles.helpIcon} title="Help">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path
                      d="M16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28Z"
                      stroke="rgba(34, 7, 11, 0.7)"
                      strokeWidth="2"
                    />
                    <path
                      d="M16 22V16M16 10H16.01"
                      stroke="rgba(34, 7, 11, 0.7)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <p className={styles.sectionDescription}>
                Please enter your desired ride information accordingly.
              </p>
            </div>
          </div>

          {/* Ride Details Outline */}
          <form onSubmit={handleSubmit}>
            <div className={styles.rideDetailsOutline}>
              {/* Form Content */}
              <div className={styles.rideDetailsContent}>
                {/* Left Column - Date Picker */}
                <div className={styles.formColumn}>
                  <div className={styles.formGroup}>
                    <div className={styles.formGroupHeader}>
                      <h3 className={styles.formGroupTitle}>Pick Up Date</h3>
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 32 32"
                        fill="none"
                        className={styles.calendarIcon}
                      >
                        <rect
                          x="4"
                          y="6"
                          width="24"
                          height="22"
                          rx="2"
                          stroke="#22070B"
                          strokeWidth="2"
                        />
                        <path
                          d="M4 12H28M10 4V8M22 4V8"
                          stroke="#22070B"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    {/* Calendar */}
                    <div className={styles.datePicker}>
                      {/* Calendar Header */}
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
                              stroke="#FC5B43"
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
                              stroke="#FC5B43"
                              strokeWidth="2"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Calendar Grid */}
                      <div className={styles.calendarGrid}>
                        <div className={styles.weekDays}>
                          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
                            (day) => (
                              <div key={day} className={styles.weekDay}>
                                {day}
                              </div>
                            ),
                          )}
                        </div>
                        <div className={styles.datesGrid}>{days}</div>
                      </div>
                      <p className={styles.calendarHint}>Pick a day.</p>
                    </div>
                  </div>
                </div>

                {/* Right Column - Time and Locations */}
                <div className={styles.formColumnRight}>
                  {/* Pick Up Time */}
                  <div className={styles.formGroup}>
                    <h3 className={styles.formGroupTitle}>Pick Up Time</h3>
                    <div className={styles.timeCell}>
                      <input
                        type="time"
                        value={pickupTime}
                        onChange={(e) => setPickupTime(e.target.value)}
                        className={styles.timeInput}
                      />
                    </div>
                  </div>

                  {/* Pick Up Time Window */}
                  <div className={styles.formGroup}>
                    <h3 className={styles.formGroupTitle}>Pick Up Time Window</h3>
                    <div className={styles.pickupWindowRow}>
                      <div className={styles.pickupWindowField}>
                        <label
                          className={styles.pickupWindowLabel}
                          htmlFor="pickup-window-from"
                        >
                          From
                        </label>
                        <div className={styles.pickupWindowCell}>
                          <input
                            id="pickup-window-from"
                            type="time"
                            value={pickupWindowFromTime}
                            onChange={(e) => setPickupWindowFromTime(e.target.value)}
                            className={styles.pickupWindowInput}
                            required
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
                          <input
                            id="pickup-window-to"
                            type="time"
                            value={pickupWindowToTime}
                            onChange={(e) => setPickupWindowToTime(e.target.value)}
                            className={styles.pickupWindowInput}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pick Up Location */}
                  <div className={styles.formGroup}>
                    <h3 className={styles.formGroupTitle}>Pick Up Location</h3>
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

                  {/* Drop Off Location */}
                  <div
                    className={`${styles.formGroup} ${styles.formGroupDropoff}`}
                  >
                    <h3 className={styles.formGroupTitle}>Drop Off Location</h3>
                    <div className={styles.locationCell}>
                      <svg
                        width="16"
                        height="20"
                        viewBox="0 0 16 20"
                        fill="none"
                        className={styles.locationIconRed}
                      >
                        <path
                          d="M8 10C9.1 10 10 9.1 10 8C10 6.9 9.1 6 8 6C6.9 6 6 6.9 6 8C6 9.1 6.9 10 8 10ZM8 0C3.6 0 0 3.6 0 8C0 12.9 8 20 8 20C8 20 16 12.9 16 8C16 3.6 12.4 0 8 0Z"
                          fill="#C73A3A"
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
                </div>
              </div>

              {/* Right: Map Image */}
              <div className={styles.mapSection}>
                <div ref={mapContainerRef} className={styles.mapImage} />
              </div>
            </div>

            {error && (
              <div className={styles.errorMessage} role="alert">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className={styles.submitButton}
            >
              <span className={styles.submitButtonText}>
                {submitting ? "Submitting..." : "Submit"}
              </span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
