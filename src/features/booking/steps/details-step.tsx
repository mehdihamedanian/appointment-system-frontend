"use client";

import { FormField } from "@/components/ui/form-field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox, Radio, RadioGroup } from "@/components/ui/selection";
import { EmptyState } from "@/components/feedback/app-states";
import { validateAdditionalFields } from "@/lib/booking/validation";
import type { AdditionalFieldDefinition } from "@/types/booking";

export function DetailsStep({
  fields,
  values,
  onChange,
  submitted,
}: {
  fields: AdditionalFieldDefinition[];
  values: Record<string, string | boolean>;
  onChange: (id: string, value: string | boolean) => void;
  submitted?: boolean;
}) {
  if (fields.length === 0) {
    return <EmptyState title="اطلاعات تکمیلی لازم نیست" description="می‌توانید به مرحله بعد بروید." />;
  }
  const errors = submitted ? validateAdditionalFields(fields, values) : {};
  return (
    <div className="ds-stack">
      {fields.map((field) => {
        const value = values[field.id];
        const error = errors[field.id];
        if (field.type === "textarea") {
          return (
            <FormField
              key={field.id}
              id={field.id}
              label={field.label}
              required={field.required}
              description={field.helpText}
              error={error}
            >
              <Textarea
                id={field.id}
                value={typeof value === "string" ? value : ""}
                maxLength={field.maxLength}
                invalid={Boolean(error)}
                onChange={(event) => onChange(field.id, event.target.value)}
              />
            </FormField>
          );
        }
        if (field.type === "select") {
          return (
            <FormField
              key={field.id}
              id={field.id}
              label={field.label}
              required={field.required}
              description={field.helpText}
              error={error}
            >
              <Select
                id={field.id}
                value={typeof value === "string" ? value : undefined}
                options={field.options}
                invalid={Boolean(error)}
                onChange={(next) => onChange(field.id, next ?? "")}
              />
            </FormField>
          );
        }
        if (field.type === "radio") {
          return (
            <RadioGroup key={field.id} legend={field.label} error={error} description={field.helpText}>
              {field.options.map((option) => (
                <Radio
                  key={option.value}
                  name={field.id}
                  value={option.value}
                  label={option.label}
                  checked={value === option.value}
                  onChange={() => onChange(field.id, option.value)}
                />
              ))}
            </RadioGroup>
          );
        }
        if (field.type === "checkbox") {
          return (
            <Checkbox
              key={field.id}
              name={field.id}
              label={field.label}
              description={field.helpText}
              error={Boolean(error)}
              checked={value === true}
              onChange={(event) => onChange(field.id, event.currentTarget.checked)}
            />
          );
        }
        return (
          <FormField
            key={field.id}
            id={field.id}
            label={field.label}
            required={field.required}
            description={field.helpText}
            error={error}
          >
            <Input
              id={field.id}
              type={field.type === "date" ? "date" : "text"}
              value={typeof value === "string" ? value : ""}
              maxLength={field.maxLength}
              invalid={Boolean(error)}
              onChange={(event) => onChange(field.id, event.target.value)}
            />
          </FormField>
        );
      })}
    </div>
  );
}
