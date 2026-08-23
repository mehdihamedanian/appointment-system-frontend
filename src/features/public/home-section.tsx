import type { ReactNode } from "react";

export function HomeSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section id={id} className="public-section" aria-labelledby={headingId}>
      <header className="public-section__header">
        <h2 id={headingId}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
