import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/lib/auth.tsx";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard/index";
import DashboardArticles from "@/pages/dashboard/articles";
import DashboardLibrary from "@/pages/dashboard/library";
import DashboardOrganization from "@/pages/dashboard/organization";
import DashboardUsers from "@/pages/dashboard/users";
import DashboardSettings from "@/pages/dashboard/settings";
import ProtectedRoute from "@/components/auth/protected-route";
import LoginForm from "@/components/auth/login-form";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={LoginForm} />
      
      {/* Dashboard Routes - Protected */}
      <Route path="/dashboard">
        {() => (
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/dashboard/articles">
        {() => (
          <ProtectedRoute>
            <DashboardArticles />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/dashboard/library">
        {() => (
          <ProtectedRoute>
            <DashboardLibrary />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/dashboard/organization">
        {() => (
          <ProtectedRoute>
            <DashboardOrganization />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/dashboard/users">
        {() => (
          <ProtectedRoute allowedRoles={["owner", "admin"]}>
            <DashboardUsers />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/dashboard/settings">
        {() => (
          <ProtectedRoute>
            <DashboardSettings />
          </ProtectedRoute>
        )}
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
