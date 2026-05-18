import Shell from "@/components/Shell";
import ConnectAccount from "@/components/accounts/ConnectAccount";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return (
    <Shell>
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">Connected Accounts</h1>
        <p className="text-sm text-white/50">
          Connect your Gmail accounts. MailFlow will read, categorize, and manage emails across all connected inboxes.
        </p>
        <ConnectAccount />
      </div>
    </Shell>
  );
}
