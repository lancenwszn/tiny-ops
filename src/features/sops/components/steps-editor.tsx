"use client";

import { ArrowDown, ArrowUp, ListOrdered, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SopStep } from "../content/model";
import { moveItem } from "../content/list";
import type { ClientAttachment } from "./attachments";

export type EditorStep = SopStep & { key: string };

export function newStep(): EditorStep {
  return { key: crypto.randomUUID(), title: "", instructions: "", notes: "", attachment_id: null };
}


export function StepsEditor({
  steps,
  onChange,
  attachments,
}: {
  steps: EditorStep[];
  onChange: (steps: EditorStep[]) => void;
  attachments: ClientAttachment[];
}) {
  const update = (i: number, patch: Partial<EditorStep>) => onChange(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5" aria-label="Step-by-step procedure">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-bold">
            <ListOrdered className="size-4 text-primary" /> Step-by-step procedure
          </h3>
          <p className="text-[13px] text-muted-foreground">Break the work into clear, numbered steps. Reorder with the arrows.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...steps, newStep()])} disabled={steps.length >= 100}>
          <Plus /> Add step
        </Button>
      </div>

      {steps.length === 0 ? (
        <button
          type="button"
          onClick={() => onChange([newStep()])}
          className="mt-4 w-full cursor-pointer rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
        >
          No steps yet — add the first one
        </button>
      ) : (
        <ol className="mt-4 grid gap-3">
          {steps.map((step, i) => (
            <li key={step.key} className="rounded-xl border border-border bg-background/60 p-3 sm:p-4" data-testid="step-editor">
              <div className="flex items-start gap-3">
                <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden>
                  {i + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`step-title-${step.key}`}>Step {i + 1} title</Label>
                    <Input
                      id={`step-title-${step.key}`}
                      value={step.title}
                      maxLength={160}
                      placeholder="e.g. Unlock the front door"
                      onChange={(e) => update(i, { title: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`step-instructions-${step.key}`}>Instructions</Label>
                    <Textarea
                      id={`step-instructions-${step.key}`}
                      value={step.instructions}
                      maxLength={5000}
                      rows={3}
                      placeholder="What exactly should be done?"
                      onChange={(e) => update(i, { instructions: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`step-notes-${step.key}`}>Notes (optional)</Label>
                      <Textarea
                        id={`step-notes-${step.key}`}
                        value={step.notes}
                        maxLength={2000}
                        rows={2}
                        placeholder="Tips, warnings, exceptions"
                        onChange={(e) => update(i, { notes: e.target.value })}
                      />
                    </div>
                    <div className="grid content-start gap-1.5">
                      <Label htmlFor={`step-file-${step.key}`}>Image or file (optional)</Label>
                      <select
                        id={`step-file-${step.key}`}
                        value={step.attachment_id ?? ""}
                        onChange={(e) => update(i, { attachment_id: e.target.value || null })}
                        className="h-10 w-full cursor-pointer rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20"
                      >
                        <option value="">None</option>
                        {attachments.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.fileName}
                          </option>
                        ))}
                      </select>
                      {attachments.length === 0 && <p className="text-xs text-muted-foreground">Upload files under Attachments to use them here.</p>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => onChange(moveItem(steps, i, i - 1))}>
                    <ArrowUp />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move step ${i + 1} down`}
                    disabled={i === steps.length - 1}
                    onClick={() => onChange(moveItem(steps, i, i + 1))}
                  >
                    <ArrowDown />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Delete step ${i + 1}`} onClick={() => onChange(steps.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
