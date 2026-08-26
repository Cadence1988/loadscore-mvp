import App from "./App.jsx";
import { routeKind } from "./auth/authConfig.js";
import AccountPage from "./pages/AccountPage.jsx";
import AuthCallbackPage from "./pages/AuthCallbackPage.jsx";

export default function AppRouter() {
  const route = routeKind(window.location.pathname);
  if (route === "auth_callback") return <AuthCallbackPage />;
  if (route === "account") return <AccountPage />;
  return <App />;
}
