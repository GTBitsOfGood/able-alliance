import styles from "./styles.module.css";

type StopTimeProps = {
  /** Time to show now (already includes any delay). */
  time: string;
  /** Original time, shown struck through when the ride is delayed. */
  originalTime?: string;
};

function StopTime({ time, originalTime }: StopTimeProps) {
  return (
    <>
      <span
        className={`${styles.stopTime} ${originalTime ? styles.stopTimeDelayed : ""}`}
      >
        {time}
      </span>
      {originalTime && (
        <span className={styles.stopTimeOriginal}>
          <span className="sr-only">Originally </span>
          {originalTime}
        </span>
      )}
    </>
  );
}

export default StopTime;
