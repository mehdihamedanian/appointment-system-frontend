import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/data-display";
import type { PublicProviderView } from "@/types/provider";

export function PublicProviderCard({
  provider,
  selected = false,
  action,
  headingLevel = "h3",
}: {
  provider: PublicProviderView;
  selected?: boolean;
  action?: ReactNode;
  headingLevel?: "h2" | "h3";
}) {
  const Title = headingLevel;
  return (
    <div className="public-provider-card" data-selected={selected ? "true" : "false"}>
      <div className="public-provider-head">
        <Avatar src={provider.imageUrl} name={provider.name} alt="" size="md" />
        <div className="public-provider-card__copy">
          <Title className="public-provider-card__name">{provider.name}</Title>
          {provider.publicTitle ? <p className="text-caption">{provider.publicTitle}</p> : null}
          {provider.specialty ? <p className="text-caption">{provider.specialty}</p> : null}
        </div>
      </div>
      {selected ? <p className="text-caption">انتخاب‌شده</p> : null}
      {provider.shortBio ? <p className="public-provider-card__bio">{provider.shortBio}</p> : null}
      {provider.relatedServiceNames.length > 0 ? (
        <p className="text-caption">{provider.relatedServiceNames.join("، ")}</p>
      ) : null}
      {provider.branchNames.length > 0 ? (
        <p className="text-caption">{provider.branchNames.join("، ")}</p>
      ) : null}
      {provider.availabilitySummary ? (
        <p className="text-caption">{provider.availabilitySummary}</p>
      ) : null}
      {action}
    </div>
  );
}
