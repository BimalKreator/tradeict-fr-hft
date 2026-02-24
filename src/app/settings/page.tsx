export default function SettingsPage() {
  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden px-4">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">Profile & Settings</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Account and app settings. Use Exchange Setup in the bottom nav to configure API keys.
      </p>
    </div>
  );
}
