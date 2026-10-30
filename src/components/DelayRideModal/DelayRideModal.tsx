"use client";

import React, { useState } from "react";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import { MAX_DELAY_MINUTES } from "@/utils/consts";

const PRESET_MINUTES = [2, 5, 10] as const;

type DelayRideModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen delay in whole minutes. */
  onConfirm: (minutes: number) => void | Promise<void>;
  /** True while the delay request is running. */
  confirming?: boolean;
};

/**
 * Lets a driver report a delay: pick a preset (2/5/10 minutes) or type a
 * custom number of minutes. Built on ConfirmActionModal.
 */
export default function DelayRideModal({
  open,
  onOpenChange,
  onConfirm,
  confirming = false,
}: DelayRideModalProps) {
  const [preset, setPreset] = useState<number | null>(null);
  const [custom, setCustom] = useState("");

  // Whichever was touched last wins: picking a preset clears the custom
  // field and typing a custom value clears the preset.
  const customMinutes = Number(custom);
  const minutes =
    preset ??
    (Number.isInteger(customMinutes) &&
    customMinutes > 0 &&
    customMinutes <= MAX_DELAY_MINUTES
      ? customMinutes
      : null);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPreset(null);
      setCustom("");
    }
    onOpenChange(next);
  };

  const optionClass = (selected: boolean) =>
    `h-[4.8rem] w-full rounded-[0.4rem] border px-[0.8rem] text-paragraph-1 ${
      selected
        ? "border-[var(--color-brand-stroke-strong)] bg-[var(--color-brand-fill)] text-[var(--color-brand-text)]"
        : "border-[var(--color-grey-stroke-weak)] bg-[var(--color-grey-fill-weak)] text-[var(--color-grey-text-weak)]"
    }`;

  return (
    <ConfirmActionModal
      open={open}
      onOpenChange={handleOpenChange}
      onConfirm={async () => {
        if (minutes === null) return;
        await onConfirm(minutes);
      }}
      variant="primary"
      title="Delay Ride"
      confirmLabel="Confirm Delay"
      confirmingLabel="Delaying…"
      hideCancelButton
      confirming={confirming}
      confirmDisabled={minutes === null}
    >
      <span
        id="delay-ride-select-time"
        className="text-paragraph-1 text-[var(--color-grey-text-strong)]"
      >
        Select time
      </span>
      <div
        role="group"
        aria-labelledby="delay-ride-select-time"
        className="grid grid-cols-4 gap-[1.6rem]"
      >
        {PRESET_MINUTES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={preset === value}
            disabled={confirming}
            className={optionClass(preset === value)}
            onClick={() => {
              setPreset(value);
              setCustom("");
            }}
          >
            {value} minutes
          </button>
        ))}
        <label
          className={`${optionClass(preset === null && minutes !== null)} flex cursor-text items-center gap-[0.4rem] focus-within:border-[var(--color-brand-stroke-strong)]`}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_DELAY_MINUTES}
            step={1}
            placeholder="Custom"
            aria-label="Custom delay in minutes"
            disabled={confirming}
            value={custom}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:italic [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            onChange={(e) => {
              setCustom(e.target.value);
              setPreset(null);
            }}
          />
          {custom && (
            <span aria-hidden className="shrink-0">
              minutes
            </span>
          )}
        </label>
      </div>
    </ConfirmActionModal>
  );
}
