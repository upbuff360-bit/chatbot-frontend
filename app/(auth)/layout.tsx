import { AuthProvider } from "@/components/AuthProvider";
import { NavigationProvider } from "@/components/NavigationContext";
import NavigationProgress from "@/components/NavigationProgress";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavigationProvider>
        <NavigationProgress />
        {children}
      </NavigationProvider>
    </AuthProvider>
  );
}