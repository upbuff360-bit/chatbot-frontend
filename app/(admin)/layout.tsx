import { AdminProvider } from "@/components/AdminProvider";
import { NavigationProvider } from "@/components/NavigationContext";
import NavigationProgress from "@/components/NavigationProgress";
import PageTransition from "@/components/PageTransition";
import Sidebar from "@/components/Sidebar";
import ToastViewport from "@/components/ToastViewport";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      {/* NavigationProvider owns the single click listener and
          shares active/completing state with both children below */}
      <NavigationProvider>
        <NavigationProgress />
        <div className="min-h-screen lg:flex">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col">
            <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
              {/* Instantly swaps to skeleton on click, restores when route completes */}
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
          <ToastViewport />
        </div>
      </NavigationProvider>
    </AdminProvider>
  );
}