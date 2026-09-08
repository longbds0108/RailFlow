import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";

export default function AppLayout({ children }) {
  return (
    <div className="dash-shell">
      <Sidebar />
      <div className="dash-main">
        <Topbar />
        <main className="dash-content">{children}</main>
      </div>
    </div>
  );
}
