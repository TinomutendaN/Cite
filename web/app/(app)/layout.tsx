import Sidebar from "@/components/Sidebar";
import { ChatProvider } from "@/components/ChatProvider";
import styles from "./layout.module.css";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChatProvider>
      <div className={styles.shell}>
        <Sidebar />
        <main className={styles.main}>{children}</main>
      </div>
    </ChatProvider>
  );
}
