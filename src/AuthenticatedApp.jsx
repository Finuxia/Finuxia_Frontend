import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ModuleGate from "./components/ModuleGate";
import PageSpinner from "./components/PageSpinner";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

// Everything an advisor uses once signed in. It is its own chunk (see App.jsx), so the public pages (booking link,
// login, register, privacy, terms) never download it, and each page below is a chunk of its own, fetched on first visit.
const Profile = lazy(() => import("./pages/Profile"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyDay = lazy(() => import("./pages/MyDay"));
const Meetings = lazy(() => import("./pages/Meetings"));
const About = lazy(() => import("./pages/About"));
const Clients = lazy(() => import("./pages/Clients"));
const Groups = lazy(() => import("./pages/Groups"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const FollowUps = lazy(() => import("./pages/FollowUps"));
const Reports = lazy(() => import("./pages/Reports"));
const Import = lazy(() => import("./pages/Import"));
const Guide = lazy(() => import("./pages/Guide"));
const Documents = lazy(() => import("./pages/Documents"));
const BookingRequests = lazy(() => import("./pages/BookingRequests"));
const BookingLinks = lazy(() => import("./pages/BookingLinks"));
const StrategyPrep = lazy(() => import("./pages/StrategyPrep"));
const Presentations = lazy(() => import("./pages/Presentations"));
const SalesPackagePrep = lazy(() => import("./pages/SalesPackagePrep"));
const Subscribe = lazy(() => import("./pages/Subscribe"));
const Billing = lazy(() => import("./pages/Billing"));
const PaymentReturn = lazy(() => import("./pages/PaymentReturn"));
const Tickets = lazy(() => import("./pages/Tickets"));
const TicketDetail = lazy(() => import("./pages/TicketDetail"));

export default function AuthenticatedApp() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Subscription gate lives outside Layout so it's full-page and the
            Layout redirect below never loops. */}
        <Route
          path="/subscribe"
          element={
            <ProtectedRoute>
              <Subscribe />
            </ProtectedRoute>
          }
        />

        {/* Where the payment provider sends the customer back to. Outside Layout like /subscribe, so an account
            whose trial has ended (the very person paying) is not bounced away before the page can confirm anything. */}
        <Route path="/billing/success" element={<ProtectedRoute><PaymentReturn outcome="success" /></ProtectedRoute>} />
        <Route path="/billing/cancel" element={<ProtectedRoute><PaymentReturn outcome="cancel" /></ProtectedRoute>} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-day" element={<MyDay />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/about" element={<About />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/follow-ups" element={<ModuleGate moduleKey="followups" moduleName="Automated Follow-Ups"><FollowUps /></ModuleGate>} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/import" element={<Import />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/booking-requests" element={<BookingRequests />} />
          <Route path="/booking-links" element={<BookingLinks />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/advisor-assistant/presentations" element={<ModuleGate moduleKey="presentations" moduleName="Presentations"><Presentations /></ModuleGate>} />
          <Route path="/advisor-assistant/strategy-prep" element={<StrategyPrep />} />
          <Route path="/advisor-assistant/sales-package" element={<ModuleGate moduleKey="sales_package_prep" moduleName="Sales Package Prep"><SalesPackagePrep /></ModuleGate>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/billing" element={<Billing />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
