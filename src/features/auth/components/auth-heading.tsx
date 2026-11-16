export function AuthHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[28px] font-extrabold tracking-tight">{title}</h1>
      {description && <p className="mt-1.5 text-[15px] text-muted-foreground">{description}</p>}
    </div>
  );
}
