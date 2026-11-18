import { Fragment, type ReactNode } from "react";
import type { RichMark, RichNode } from "./model";
import { safeHref, sanitizeDoc } from "./sanitize";
import { cn } from "@/lib/utils";

/**
 * Renders SOP rich text as React elements (no dangerouslySetInnerHTML).
 * Content is re-sanitized here, so even data written directly through the
 * API cannot inject markup. Images resolve to short-lived signed URLs.
 */
export function RichText({
  doc,
  imageUrls = {},
  className,
}: {
  doc: unknown;
  imageUrls?: Record<string, string>;
  className?: string;
}) {
  const clean = sanitizeDoc(doc);
  if (!clean?.content?.length) return null;
  return <div className={cn("sop-prose", className)}>{renderChildren(clean.content, imageUrls)}</div>;
}

function renderChildren(nodes: RichNode[] | undefined, imageUrls: Record<string, string>): ReactNode {
  return (nodes ?? []).map((n, i) => <Fragment key={i}>{renderNode(n, imageUrls)}</Fragment>);
}

function renderMarks(text: string, marks: RichMark[] | undefined): ReactNode {
  let out: ReactNode = text;
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case "bold":
        out = <strong>{out}</strong>;
        break;
      case "italic":
        out = <em>{out}</em>;
        break;
      case "underline":
        out = <u>{out}</u>;
        break;
      case "strike":
        out = <s>{out}</s>;
        break;
      case "code":
        out = <code>{out}</code>;
        break;
      case "link": {
        const href = safeHref(mark.attrs?.href);
        if (href) out = <a href={href} target="_blank" rel="noopener noreferrer nofollow">{out}</a>;
        break;
      }
    }
  }
  return out;
}

function renderNode(node: RichNode, imageUrls: Record<string, string>): ReactNode {
  const children = renderChildren(node.content, imageUrls);
  switch (node.type) {
    case "text":
      return renderMarks(node.text ?? "", node.marks);
    case "paragraph":
      return <p>{children}</p>;
    case "heading":
      return node.attrs?.level === 3 ? <h4>{children}</h4> : <h3>{children}</h3>;
    case "bulletList":
      return <ul>{children}</ul>;
    case "orderedList":
      return <ol start={Number(node.attrs?.start) || 1}>{children}</ol>;
    case "listItem":
      return <li>{children}</li>;
    case "taskList":
      return <ul data-type="taskList">{children}</ul>;
    case "taskItem":
      return (
        <li data-checked={node.attrs?.checked === true}>
          <input type="checkbox" checked={node.attrs?.checked === true} readOnly disabled aria-label={node.attrs?.checked ? "Done" : "Not done"} />
          <div>{children}</div>
        </li>
      );
    case "blockquote":
      return <blockquote>{children}</blockquote>;
    case "horizontalRule":
      return <hr />;
    case "hardBreak":
      return <br />;
    case "table":
      return (
        <div className="sop-table">
          <table>
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr>{children}</tr>;
    case "tableHeader":
      return (
        <th colSpan={Number(node.attrs?.colspan) || 1} rowSpan={Number(node.attrs?.rowspan) || 1}>
          {children}
        </th>
      );
    case "tableCell":
      return (
        <td colSpan={Number(node.attrs?.colspan) || 1} rowSpan={Number(node.attrs?.rowspan) || 1}>
          {children}
        </td>
      );
    case "image": {
      const id = String(node.attrs?.attachmentId ?? "");
      const src = imageUrls[id];
      const alt = String(node.attrs?.alt ?? "");
      // eslint-disable-next-line @next/next/no-img-element -- private, signed, short-lived URL
      return src ? <img src={src} alt={alt} loading="lazy" /> : <span className="sop-missing-image">Image unavailable</span>;
    }
    default:
      return null;
  }
}
