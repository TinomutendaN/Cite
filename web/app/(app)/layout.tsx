import Sidebar from "@/components/Sidebar";
import styles from "./layout.module.css";

// TODO: wrap in ChatProvider once the chat is built.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
