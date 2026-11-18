"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
  Unlink,
  Columns3,
  Rows3,
  TableCellsMerge,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { safeHref } from "../content/sanitize";
import type { RichDoc, RichNode } from "../content/model";
import { cn } from "@/lib/utils";

export type ImageOption = { id: string; name: string; url: string };

/** Image node that stores a private attachment id; `src` is a display-only signed URL. */
const AttachmentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      attachmentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-attachment-id"),
        renderHTML: (attrs) => (attrs.attachmentId ? { "data-attachment-id": attrs.attachmentId } : {}),
      },
    };
  },
});

/** Adds display URLs to stored image nodes (which only keep attachmentId). */
function withImageUrls(doc: RichDoc | undefined, urls: Record<string, string>): RichDoc | undefined {
  if (!doc) return doc;
  const walk = (n: RichNode): RichNode => {
    if (n.type === "image") {
      const id = String(n.attrs?.attachmentId ?? "");
      return { ...n, attrs: { ...n.attrs, src: urls[id] ?? "" } };
    }
    return n.content ? { ...n, content: n.content.map(walk) } : n;
  };
  return { ...doc, content: doc.content?.map(walk) };
}

export function RichTextEditor({
  label,
  hint,
  value,
  onChange,
  images,
  imageUrls,
  placeholder,
  editable = true,
}: {
  label: string;
  hint?: string;
  value: RichDoc | undefined;
  onChange: (doc: RichDoc) => void;
  images: ImageOption[];
  imageUrls: Record<string, string>;
  placeholder?: string;
  /** False when the SOP is archived or in an edit conflict. */
  editable?: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      AttachmentImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
    ],
    content: withImageUrls(value, imageUrls) ?? "",
    editorProps: {
      attributes: { class: "sop-prose", "aria-label": label, "aria-multiline": "true", role: "textbox" },
      // Pasted/dropped files are not uploaded through the editor; use Attachments.
      handleDrop: (_view, event) => Boolean(event.dataTransfer?.files?.length),
      handlePaste: (_view, event) => Boolean(event.clipboardData?.files?.length),
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as RichDoc),
  });

  // Keep editability in sync (fieldset "disabled" does not affect contenteditable).
  useEffect(() => {
    if (editor && editor.isEditable !== editable) editor.setEditable(editable, false);
  }, [editor, editable]);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card" aria-label={label}>
      <div className="px-4 pb-1 pt-4 sm:px-5">
        <h3 className="text-[15px] font-bold">{label}</h3>
        {hint && <p className="text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      {editor && editable && <Toolbar editor={editor} onLink={() => setLinkOpen(true)} onImage={() => setImageOpen(true)} hasImages={images.length > 0} />}
      <div className="sop-editor px-4 pb-4 pt-2 sm:px-5">
        <EditorContent editor={editor} />
      </div>
      {editor && <LinkDialog editor={editor} open={linkOpen} onOpenChange={setLinkOpen} />}
      {editor && <ImageDialog editor={editor} open={imageOpen} onOpenChange={setImageOpen} images={images} />}
    </section>
  );
}

function Toolbar({ editor, onLink, onImage, hasImages }: { editor: Editor; onLink: () => void; onImage: () => void; hasImages: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      table: e.isActive("table"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();

  return (
    <div role="toolbar" aria-label="Formatting" className="sticky top-[72px] z-10 mx-3 flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-muted/70 p-1 backdrop-blur sm:mx-4">
      <Tool label="Heading" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} icon={Heading2} />
      <Tool label="Subheading" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} icon={Heading3} />
      <Sep />
      <Tool label="Bold" shortcut="⌘B" active={s.bold} onClick={() => c().toggleBold().run()} icon={Bold} />
      <Tool label="Italic" shortcut="⌘I" active={s.italic} onClick={() => c().toggleItalic().run()} icon={Italic} />
      <Tool label="Underline" shortcut="⌘U" active={s.underline} onClick={() => c().toggleUnderline().run()} icon={Underline} />
      <Tool label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()} icon={Strikethrough} />
      <Sep />
      <Tool label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()} icon={List} />
      <Tool label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()} icon={ListOrdered} />
      <Tool label="Checklist" active={s.task} onClick={() => c().toggleTaskList().run()} icon={ListChecks} />
      <Tool label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()} icon={Quote} />
      <Sep />
      <Tool label={s.link ? "Edit link" : "Add link"} active={s.link} onClick={onLink} icon={Link2} />
      {s.link && <Tool label="Remove link" onClick={() => c().unsetLink().run()} icon={Unlink} />}
      <Tool label="Insert table" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} icon={Table2} />
      {s.table && (
        <>
          <Tool label="Add row" onClick={() => c().addRowAfter().run()} icon={Rows3} />
          <Tool label="Add column" onClick={() => c().addColumnAfter().run()} icon={Columns3} />
          <Tool label="Merge or split cells" onClick={() => c().mergeOrSplit().run()} icon={TableCellsMerge} />
          <Tool label="Delete table" onClick={() => c().deleteTable().run()} icon={Trash2} />
        </>
      )}
      <Tool label={hasImages ? "Insert image" : "Upload an image under Attachments first"} disabled={!hasImages} onClick={onImage} icon={ImagePlus} />
      <Tool label="Divider" onClick={() => c().setHorizontalRule().run()} icon={Minus} />
      <span className="ml-auto flex">
        <Tool label="Undo" shortcut="⌘Z" disabled={!s.canUndo} onClick={() => c().undo().run()} icon={Undo2} />
        <Tool label="Redo" shortcut="⇧⌘Z" disabled={!s.canRedo} onClick={() => c().redo().run()} icon={Redo2} />
      </span>
    </div>
  );
}

function Sep() {
  return <span aria-hidden className="mx-0.5 h-5 w-px bg-border" />;
}

function Tool({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn(
            "flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground/75 transition-colors hover:bg-card hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35",
            active && "bg-card text-primary shadow-xs",
          )}
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

function LinkDialog({ editor, open, onOpenChange }: { editor: Editor; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onOpen(o: boolean) {
    if (o) {
      setUrl(String(editor.getAttributes("link").href ?? ""));
      setError(null);
    }
    onOpenChange(o);
  }

  function apply() {
    const candidate = /^[a-z]+:/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    const href = safeHref(candidate);
    if (!href) return setError("Enter a valid web address (https://…) or email (mailto:…).");
    const chain = editor.chain().focus().extendMarkRange("link");
    if (editor.state.selection.empty && !editor.isActive("link")) {
      chain.insertContent({ type: "text", text: url.trim(), marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link</DialogTitle>
          <DialogDescription>Links open in a new tab for readers.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="grid gap-3"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="link-url">Web address</Label>
            <Input id="link-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" autoFocus aria-invalid={Boolean(error)} />
            {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit">Apply link</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ImageDialog({ editor, open, onOpenChange, images }: { editor: Editor; open: boolean; onOpenChange: (o: boolean) => void; images: ImageOption[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Insert an image</DialogTitle>
          <DialogDescription>Choose one of this SOP&apos;s image attachments. Images stay private to people who can read the SOP.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
          {images.map((img) => (
            <button
              key={img.id}
              type="button"
              className="group cursor-pointer overflow-hidden rounded-xl border border-border text-left hover:border-primary"
              onClick={() => {
                editor.chain().focus().insertContent({ type: "image", attrs: { src: img.url, alt: img.name, attachmentId: img.id } }).run();
                onOpenChange(false);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
              <img src={img.url} alt="" className="aspect-video w-full bg-muted object-cover" />
              <span className="block truncate px-2 py-1.5 text-xs font-medium">{img.name}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
