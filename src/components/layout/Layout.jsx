import { Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  Plus,
  LayoutGrid,
  CalendarDays,
  Users,
  Clock,
  Upload,
  BarChart3,
  BookOpen,
  Sparkles,
  Target,
  Presentation,
  ChevronDown,
  User as UserIcon,
  LogOut,
  LifeBuoy,
  UsersRound,
  FolderCog,
  FileStack,
  CalendarClock,
  Link2,
  Info,
  Package,
  CreditCard,
} from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import useMenu from "../../hooks/useMenu";
import GlobalSearch from "./GlobalSearch";
import NotificationsDropdown from "./NotificationsDropdown";
import AddClientModal from "../clients/AddClientModal";
import ReconnectModal from "../integrations/ReconnectModal";
import ConnectNudgeModal from "../integrations/ConnectNudgeModal";
import Footer from "./Footer";
import TrialBanner from "../TrialBanner";
import VerifyEmailNotice from "../account/VerifyEmailNotice";
import PageSpinner from "../ui/PageSpinner";
import RouteErrorBoundary from "./RouteErrorBoundary";

// The everyday, single-click items — kept short on purpose so the bar
// doesn't get crowded. Everything else lives in one of the dropdowns below.
const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/my-day", label: "My Day", icon: CalendarDays },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

// Dropdown menus — same shape as NAV_LINKS items, grouped under a label.
const NAV_MENUS = [
  {
    label: "Clients",
    icon: Users,
    items: [
      { to: "/clients", label: "All Clients", icon: Users },
      { to: "/groups", label: "Groups", icon: UsersRound },
      { to: "/follow-ups", label: "Follow-ups", icon: Clock },
      { to: "/import", label: "Import", icon: Upload },
    ],
  },
  {
    label: "Meetings",
    icon: CalendarClock,
    items: [
      { to: "/meetings", label: "Calendar Meetings", icon: CalendarDays },
      { to: "/booking-links", label: "Booking Links", icon: Link2 },
      { to: "/booking-requests", label: "Booking Requests", icon: CalendarClock },
    ],
  },
  {
    label: "Advisor Assistant",
    icon: Sparkles,
    items: [
      { to: "/advisor-assistant/presentations", label: "Presentations", icon: Presentation },
      { to: "/advisor-assistant/sales-package", label: "Sales Package Prep", icon: Package },
      { to: "/advisor-assistant/strategy-prep", label: "Strategy Prep", icon: Target },
    ],
  },
  {
    label: "Resources",
    icon: FolderCog,
    items: [
      { to: "/guide", label: "Guide", icon: BookOpen },
      { to: "/documents", label: "Documents", icon: FileStack },
      { to: "/tickets", label: "Support", icon: LifeBuoy },
      { to: "/about", label: "About Finuxia", icon: Info },
    ],
  },
];

export default function Layout() {
  const [modalOpen, setModalOpen] = useState(false);
  const { user, billing } = useAuth();

  // Email gate: an unverified account can sign in but sees only the "confirm your email"
  // screen — no trial has started and AI credit can't be spent until the link is used.
  // (Strict false: an older API that doesn't report the field must not lock anyone out.)
  if (user && user.emailVerified === false) {
    return <VerifyEmailNotice />;
  }

  // Trial/subscription gate: once access has lapsed, everything routes to the
  // subscribe page (which lives outside this Layout, so no redirect loop).
  if (user && user.subscriptionActive === false) {
    return <Navigate to="/subscribe" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <a
        href="#main-content"
        onClick={(e) => {
          // A plain #anchor would change the URL the router owns: move focus to the content instead.
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-navy focus:shadow-lg"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-navy">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <NavLink to="/dashboard" className="flex shrink-0 items-center gap-2">
            <Logo size={20} />
            <span className="text-base font-bold tracking-tight text-white">
              Fin<span className="text-gold">uxia</span>
            </span>
          </NavLink>

          <div className="order-3 w-full sm:order-2 sm:w-auto sm:flex-1 sm:px-4">
            <GlobalSearch />
          </div>

          <div className="order-2 flex shrink-0 items-center gap-1 sm:order-3">
            <NotificationsDropdown />
            <UserMenu user={user} />
          </div>
        </div>

        <div className="border-t border-white/5">
          <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-1.5 sm:px-6">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? "bg-white/10 text-gold" : "text-slate-300 hover:text-white"
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
            {NAV_MENUS.map((menu) => (
              <NavDropdown key={menu.label} menu={menu} />
            ))}
          </nav>
        </div>
      </header>

      <TrialBanner user={user} billing={billing} />

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 outline-none sm:px-6">
        <RouteErrorBoundary>
          {/* A page's code is fetched on first visit: the navigation stays, only this area shows the spinner. */}
          <Suspense fallback={<PageSpinner inline />}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>

      <Footer />

      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-gold px-5 py-3.5 text-sm font-semibold text-navy shadow-lg shadow-gold/30 transition hover:scale-105 hover:bg-gold-light active:scale-95"
      >
        <Plus size={18} strokeWidth={2.5} />
        Add Client
      </button>

      <AddClientModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ReconnectModal />
      <ConnectNudgeModal />
    </div>
  );
}

function NavDropdown({ menu }) {
  const { icon: Icon, label, items } = menu;
  const location = useLocation();
  const isActive = items.some((item) => location.pathname.startsWith(item.to));
  const { open, pos, close, triggerProps, menuProps, itemProps } = useMenu({ align: "left" });

  return (
    <>
      <button
        {...triggerProps}
        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          open || isActive ? "bg-white/10 text-gold" : "text-slate-300 hover:text-white"
        }`}
      >
        <Icon size={14} aria-hidden="true" />
        {label}
        <ChevronDown size={13} aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {/* Rendered in a portal so the nav's overflow-x-auto can't clip it. */}
      {open &&
        pos &&
        createPortal(
          <div
            {...menuProps}
            aria-label={label}
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-[60] w-52 animate-fade-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
          >
            {items.map(({ to, label: itemLabel, icon: ItemIcon }) => (
              <NavLink
                {...itemProps}
                key={to}
                to={to}
                onClick={() => close()}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                    isActive ? "bg-gold/10 text-gold-dark" : "text-slate-600 hover:bg-slate-50 hover:text-navy"
                  }`
                }
              >
                <ItemIcon size={15} aria-hidden="true" />
                {itemLabel}
              </NavLink>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}

function UserMenu({ user }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { open, pos, close, triggerProps, menuProps, itemProps } = useMenu({ align: "right" });

  const handleLogout = () => {
    close();
    logout();
    navigate("/login", { replace: true });
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
      isActive ? "bg-gold/10 text-gold-dark" : "text-slate-600 hover:bg-slate-50 hover:text-navy"
    }`;

  return (
    <>
      <button
        {...triggerProps}
        className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gold text-sm font-bold text-navy"
        aria-label={user?.name ? `Account menu for ${user.name}` : "Account menu"}
        title={user?.name}
      >
        {user?.hasAvatar ? (
          <img src={api.avatarUrl(user.id)} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">{user?.name?.[0]?.toUpperCase() ?? "?"}</span>
        )}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            {...menuProps}
            aria-label="Account"
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-[60] w-52 animate-fade-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
          >
            <div role="presentation" className="mb-1 border-b border-slate-100 px-3 py-2">
              <p className="truncate text-sm font-semibold text-navy">{user?.name}</p>
              <p className="truncate text-xs text-slate-400">{user?.email}</p>
            </div>
            <NavLink {...itemProps} to="/profile" onClick={() => close()} className={linkClass}>
              <UserIcon size={15} aria-hidden="true" />
              Profile
            </NavLink>
            <NavLink {...itemProps} to="/billing" onClick={() => close()} className={linkClass}>
              <CreditCard size={15} aria-hidden="true" />
              Plans &amp; Billing
            </NavLink>
            <button
              {...itemProps}
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-av-red transition hover:bg-av-red/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-av-red"
            >
              <LogOut size={15} aria-hidden="true" />
              Log Out
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
