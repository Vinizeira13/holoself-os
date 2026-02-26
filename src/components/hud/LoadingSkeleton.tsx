/**
 * Holographic loading skeleton — pulsing placeholder for data loading
 */
export function LoadingSkeleton({ width = "100%", height = 14, count = 1 }: {
  width?: string | number;
  height?: number;
  count?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="holo-pulse"
          style={{
            width: typeof width === "number" ? `${width}px` : width,
            height,
            borderRadius: 6,
            background: "linear-gradient(90deg, rgba(120, 200, 255, 0.05), rgba(120, 200, 255, 0.12), rgba(120, 200, 255, 0.05))",
            backgroundSize: "200% 100%",
            animation: "skeleton-shimmer 1.5s ease-in-out infinite, holo-pulse 2s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}
