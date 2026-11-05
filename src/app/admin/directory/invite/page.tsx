"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import BogTextInput from "@/components/BogTextInput/BogTextInput";
import BogButton from "@/components/BogButton/BogButton";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import InvitationTypes from "@/components/InvitationTypes";
import { baseUserSchema, studentSchema } from "@/schemas/user";
import type { UserType } from "@db/generated/enums";
import styles from "./inviteUser.module.css";

export default function InviteUserPage() {
  const { data: session } = useSession();
  const canInviteAdmins = session?.user?.activeType === "SuperAdmin";
  const router = useRouter();
  const [types, setTypes] = useState<UserType[]>([]);
  const [accessibilityNeeds, setAccessibilityNeeds] = useState<string[]>([]);
  const [accommodations, setAccommodations] = useState<string[]>([]);
  const [accommodationError, setAccommodationError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isStudent = types.includes("Student");

  useEffect(() => {
    if (!isStudent) return;
    const controller = new AbortController();
    fetch("/api/accommodations", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Unable to load accessibility options.");
        const options: { label: string }[] = await response.json();
        setAccommodations(options.map(({ label }) => label));
        setAccommodationError("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setAccommodationError(cause.message);
      });
    return () => controller.abort();
  }, [isStudent]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const payload = {
      firstName: value("firstName"),
      lastName: value("lastName"),
      preferredName: value("preferredName"),
      username: value("username"),
      email: value("email"),
      types,
      ...(isStudent
        ? { studentInfo: { notes: value("notes"), accessibilityNeeds } }
        : {}),
    };
    const parsed = (isStudent ? studentSchema : baseUserSchema).safeParse(
      payload,
    );
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Unable to invite this user. Check their details and try again.",
        );
      router.push(`/profile/${result.id}`);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to invite this user.",
      );
      setSubmitting(false);
    }
  }

  if (!session?.user) return null;

  return (
    <div className={styles.page}>
      <Link href="/admin/directory/students" className={styles.back}>
        Back to directory
      </Link>
      <h1>Invite user</h1>
      <form onSubmit={invite} className={styles.form}>
        <fieldset disabled={submitting} className={styles.fields}>
          <div className={styles.row}>
            <BogTextInput
              name="firstName"
              label="First name"
              placeholder="George"
              required
            />
            <BogTextInput
              name="lastName"
              label="Last name"
              placeholder="Burdell"
              required
            />
          </div>
          <div className={styles.row}>
            <BogTextInput
              name="preferredName"
              label="Preferred name"
              placeholder="What should we call them?"
            />
            <BogTextInput
              name="username"
              label="GT username"
              placeholder="gburdell3"
              required
            />
          </div>
          <BogTextInput
            name="email"
            type="email"
            label="GT email"
            placeholder="gburdell3@gatech.edu"
            required
          />
          <InvitationTypes
            value={types}
            onChange={setTypes}
            canInviteAdmins={canInviteAdmins}
            disabled={submitting}
          />
          {isStudent && (
            <section
              className={styles.student}
              aria-labelledby="student-details-title"
            >
              <h2 id="student-details-title">Student details</h2>
              <BogDropdown
                name="accessibilityNeeds"
                type="checkbox"
                label="Accessibility needs"
                placeholder="Select accessibility needs"
                options={accommodations}
                value={accessibilityNeeds}
                onSelectionChange={(selection) =>
                  setAccessibilityNeeds(
                    Array.isArray(selection) ? selection : [selection],
                  )
                }
              />
              {accommodationError && <p role="status">{accommodationError}</p>}
              <BogTextInput
                name="notes"
                label="Rider notes"
                placeholder="Add any instructions for drivers."
                multiline
              />
            </section>
          )}
        </fieldset>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <BogButton type="submit" disabled={submitting || types.length === 0}>
            {submitting ? "Inviting…" : "Invite user"}
          </BogButton>
          <Link href="/admin/directory/students">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
