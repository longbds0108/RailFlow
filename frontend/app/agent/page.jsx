import WalletGate from "../../components/WalletGate";
import AgentChat from "../../components/AgentChat";

export default function AgentPage() {
  return (
    <div>
      <h1 className="page-title">Assistant</h1>
      <p className="page-subtitle">
        Chat to check balances and history, or to send, swap, stake, or bridge — the
        assistant only ever prepares a transaction. You always review and sign it
        yourself in MetaMask, just like the other modules.
      </p>
      <WalletGate>
        <AgentChat />
      </WalletGate>
    </div>
  );
}
