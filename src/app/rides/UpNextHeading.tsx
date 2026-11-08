import {
  estDateKey,
  formatEstDate,
  isEstToday,
  withDelay,
} from "@/utils/dateEst";
import styles from "./student-rides.module.css";

export default function UpNextHeading({
  id,
  pickupTime,
  delayMinutes = 0,
}: {
  id: string;
  pickupTime?: string;
  delayMinutes?: number | null;
}) {
  const date = pickupTime
    ? withDelay(new Date(pickupTime), delayMinutes ?? 0)
    : null;
  const showDate = date && !isEstToday(date);

  return (
    <div className={styles.upNextHeading}>
      <h2 id={id} className={styles.sectionTitle}>
        Up Next
      </h2>
      {showDate && (
        <time className={styles.description} dateTime={estDateKey(date)}>
          {formatEstDate(date, {
            weekday: "long",
            month: "long",
            day: "numeric",
            ...(estDateKey(date).slice(0, 4) !==
            estDateKey(new Date()).slice(0, 4)
              ? { year: "numeric" }
              : {}),
          })}
        </time>
      )}
    </div>
  );
}
