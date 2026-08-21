export function RouteShell({
  title,
  description,
  identity,
}: {
  title: string;
  description: string;
  identity?: string;
}) {
  return (
    <section className="route-shell" aria-labelledby="route-shell-title">
      <p className="route-shell__eyebrow">نقطه ورود مرحله‌های بعد</p>
      <h1 id="route-shell-title">{title}</h1>
      {identity ? (
        <p>
          شناسه:{" "}
          <span className="ltr-value" dir="ltr">
            {identity}
          </span>
        </p>
      ) : null}
      <p>{description}</p>
    </section>
  );
}
