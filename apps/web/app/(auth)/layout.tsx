export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col gap-4 px-5 pt-12 pb-6">{children}</main>;
}
