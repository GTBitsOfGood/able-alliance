import styles from "./styles.module.css";

export default function ChatSystemMessage({
  text,
  time,
}: {
  text: string;
  time: string;
}) {
  return (
    <div className={styles.systemMessage}>
      <span className={styles.label}>System</span>
      <p>{text}</p>
      <time dateTime={time}>
        {new Date(time).toLocaleString("en-US", {
          timeZone: "America/New_York",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </time>
    </div>
  );
}
