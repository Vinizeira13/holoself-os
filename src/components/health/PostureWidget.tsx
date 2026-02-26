import { PostureState } from "../../hooks/usePostureMonitor";

interface Props {
  posture: PostureState;
}

export function PostureWidget({ posture }: Props) {
  const scoreColor = posture.score >= 80
    ? "var(--holo-primary)"
    : posture.score >= 50
      ? "var(--holo-accent)"
      : "var(--holo-alert)";

  const badMins = Math.floor(posture.badDurationMs / 60_000);

  return (
    <div className="holo-card">
      <span className="holo-label">POSTURA</span>
      <div className="holo-metric" style={{ color: scoreColor }}>
        {posture.headPosition ? `${posture.score}` : "--"}
        <span style={{ fontSize: 9, opacity: 0.6 }}>/100</span>
      </div>

      {posture.isBadPosture && badMins > 0 && (
        <div style={{ fontSize: 7, color: "var(--holo-alert)", marginTop: 2 }}>
          Slouching {badMins}min
        </div>
      )}

      {/* Mini posture indicator bar */}
      {posture.headPosition && (
        <div style={{
          marginTop: 4,
          width: "100%",
          height: 3,
          borderRadius: 2,
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}>
          <div style={{
            width: `${posture.score}%`,
            height: "100%",
            background: scoreColor,
            borderRadius: 2,
            transition: "width 1s ease, background 0.5s ease",
          }} />
        </div>
      )}
    </div>
  );
}
