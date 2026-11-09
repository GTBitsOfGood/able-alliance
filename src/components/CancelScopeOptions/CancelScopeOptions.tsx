"use client";

import React from "react";
import BogRadioGroup from "@/components/BogRadioGroup/BogRadioGroup";
import BogRadioItem from "@/components/BogRadioItem/BogRadioItem";

export type CancelScope = "single" | "series";

type CancelScopeOptionsProps = {
  value: CancelScope;
  onChange: (scope: CancelScope) => void;
  disabled?: boolean;
};

/** Picks whether cancelling a recurring ride also cancels the rest of its series. */
export default function CancelScopeOptions({
  value,
  onChange,
  disabled = false,
}: CancelScopeOptionsProps) {
  return (
    <BogRadioGroup
      aria-label="Which rides to cancel"
      value={value}
      onValueChange={(next) => onChange(next as CancelScope)}
      disabled={disabled}
      className="gap-[1.2rem]"
    >
      <BogRadioItem value="single" label="Only this ride" disabled={disabled} />
      <BogRadioItem
        value="series"
        label="This ride and all future rides in the series (stops the recurring schedule)"
        disabled={disabled}
      />
    </BogRadioGroup>
  );
}
