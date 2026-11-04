"use client";

import React, { useState } from "react";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import { MAX_DELAY_MINUTES } from "@/utils/consts";

const PRESET_MINUTES = [5, 10, 15] as const;

type DelayRideModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen delay in whole minutes. */
  onConfirm: (minutes: number) => void | Promise<void>;
  /** True while the delay request is running. */
  confirming?: boolean;
  /** Error message to display if the delay request fails. */
  delayActionError?: string;
  currentDelayMinutes: number;
  onCancelRide: () => void;
};

/**
 * Lets a student report a delay: pick a preset (5/10/15 minutes) or type a
 * custom number of minutes. Built on ConfirmActionModal.
 */
export default function DelayRideModal({
  open,
  onOpenChange,
  onConfirm,
  confirming = false,
  delayActionError,
  currentDelayMinutes,
  onCancelRide,
}: DelayRideModalProps) {
  const [preset, setPreset] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPreset(null);
      setCustom("");
    }
  }

  // Whichever was touched last wins: picking a preset clears the custom
  // field and typing a custom value clears the preset.
  const customMinutes = Number(custom);
  const remainingMinutes = Math.max(0, MAX_DELAY_MINUTES - currentDelayMinutes);
  const chosenMinutes = preset ?? customMinutes;
  const minutes =
    Number.isInteger(chosenMinutes) &&
    chosenMinutes > 0 &&
    chosenMinutes <= remainingMinutes
      ? chosenMinutes
      : null;

  const optionClass = (selected: boolean, disabled: boolean) =>
    `h-[4.8rem] w-full rounded-[0.4rem] border px-[0.8rem] text-paragraph-1 transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${disabled ? "" : "cursor-pointer hover:border-brand-stroke-strong hover:bg-brand-fill hover:text-brand-text"} ${
      selected
        ? "border-[var(--color-brand-stroke-strong)] bg-[var(--color-brand-fill)] text-[var(--color-brand-text)]"
        : "border-[var(--color-grey-stroke-weak)] bg-[var(--color-grey-fill-weak)] text-[var(--color-grey-text-weak)]"
    }`;

  return (
    <ConfirmActionModal
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={async () => {
        if (minutes === null) return;
        await onConfirm(minutes);
      }}
      variant="primary"
      title="Delay Ride?"
      description={
        <>
          {remainingMinutes === 0
            ? `You've reached the ${MAX_DELAY_MINUTES}-minute delay limit.`
            : currentDelayMinutes > 0
              ? `You can add up to ${remainingMinutes} more ${remainingMinutes === 1 ? "minute" : "minutes"} to your delay.`
              : `Delay your ride by up to ${MAX_DELAY_MINUTES} minutes.`}{" "}
          If you need longer,{" "}
          <button
            type="button"
            className="text-brand-text underline underline-offset-2 transition-colors enabled:cursor-pointer enabled:hover:text-status-red-text enabled:hover:decoration-2 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={confirming}
            onClick={onCancelRide}
          >
            cancel your ride
          </button>
          .
        </>
      }
      confirmLabel="Confirm Delay"
      confirmingLabel="Delaying…"
      cancelLabel="Nevermind"
      confirming={confirming}
      confirmDisabled={minutes === null}
    >
      <span
        id="delay-ride-select-time"
        className="text-paragraph-1 text-[var(--color-grey-text-strong)]"
      >
        Delay by
      </span>
      <div
        role="group"
        aria-labelledby="delay-ride-select-time"
        className="grid grid-cols-2 gap-[1.6rem] tablet:grid-cols-4"
      >
        {PRESET_MINUTES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={preset === value}
            disabled={confirming || value > remainingMinutes}
            className={optionClass(
              preset === value,
              confirming || value > remainingMinutes,
            )}
            onClick={() => {
              setPreset(value);
              setCustom("");
            }}
          >
            {value} minutes
          </button>
        ))}
        <label
          className={`${optionClass(preset === null && minutes !== null, confirming || remainingMinutes === 0)} flex cursor-text items-center gap-[0.4rem] focus-within:border-[var(--color-brand-stroke-strong)]`}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={remainingMinutes}
            step={1}
            placeholder="Custom"
            aria-label="Custom delay in minutes"
            disabled={confirming || remainingMinutes === 0}
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
        <div className="col-span-full text-paragraph-1 text-status-red-text">
          {custom && minutes === null && (
            <p role="alert">
              Enter a whole number from 1 to {remainingMinutes}, or cancel your
              ride if you need longer.
            </p>
          )}
          {delayActionError && (
            <span role="alert" aria-live="polite">
              {delayActionError}
            </span>
          )}
        </div>
      </div>
    </ConfirmActionModal>
  );
}
