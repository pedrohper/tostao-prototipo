export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-6 px-6 pt-14 pb-8">{children}</main>;
}
