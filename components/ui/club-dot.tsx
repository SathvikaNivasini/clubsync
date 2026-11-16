export function ClubDot({ color, size = 9 }: { color: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: `0 0 0 3px ${color}26`,
      }}
    />
  );
}

/** Club identity chip — colour plus name, so clubs stay distinguishable
 *  without relying on colour alone. */
export function ClubChip({
  name,
  color,
  code,
}: {
  name: string;
  color: string;
  code?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        borderColor: `${color}4d`,
        backgroundColor: `${color}14`,
        color: "var(--color-ink)",
      }}
    >
      <ClubDot color={color} size={7} />
      {name}
      {code ? <span className="font-mono text-[0.6875rem] text-muted">{code}</span> : null}
    </span>
  );
}
