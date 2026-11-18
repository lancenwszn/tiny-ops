import { RichText } from "../content/rich-text";
import { SECTION_KEYS, SECTION_META, isDocEmpty, type SopContent as Content } from "../content/model";
import type { Attachment } from "../queries";
import { StepAttachment } from "./step-attachment";

export type { Content };

/** Read-only rendering of an SOP's sections and steps (reader + version views). */
export function SopContentView({
  content,
  attachments,
  imageUrls,
}: {
  content: { sections: Content["sections"]; steps: Content["steps"] };
  attachments: Attachment[];
  imageUrls: Record<string, string>;
}) {
  const sections = SECTION_KEYS.filter((k) => !isDocEmpty(content.sections[k]));
  const byId = new Map(attachments.map((a) => [a.id, a]));

  return (
    <div className="grid gap-5">
      {sections.map((key) => (
        <section key={key} className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" aria-labelledby={`sec-${key}`}>
          <h2 id={`sec-${key}`} className="mb-3 text-lg font-bold">
            {SECTION_META[key].label}
          </h2>
          <RichText doc={content.sections[key]} imageUrls={imageUrls} />
        </section>
      ))}

      {content.steps.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6" aria-labelledby="sec-steps">
          <h2 id="sec-steps" className="mb-4 text-lg font-bold">
            Step-by-step procedure
          </h2>
          <ol className="grid gap-4">
            {content.steps.map((step, i) => {
              const att = step.attachment_id ? byId.get(step.attachment_id) : undefined;
              return (
                <li key={i} className="flex gap-4" data-testid="step">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 border-b border-border pb-4 last:border-0">
                    <h3 className="font-bold">
                      <span className="sr-only">Step {i + 1}: </span>
                      {step.title}
                    </h3>
                    {step.instructions && <p className="mt-1 whitespace-pre-line text-[15px] leading-7 text-foreground/85">{step.instructions}</p>}
                    {step.notes && (
                      <p className="mt-2 whitespace-pre-line rounded-lg bg-tint-amber px-3 py-2 text-[13.5px] text-foreground/85">
                        <span className="font-semibold text-tint-amber-fg">Note: </span>
                        {step.notes}
                      </p>
                    )}
                    {att && <StepAttachment attachment={att} imageUrl={imageUrls[att.id]} />}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {sections.length === 0 && content.steps.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">This SOP has no content yet.</p>
      )}
    </div>
  );
}
