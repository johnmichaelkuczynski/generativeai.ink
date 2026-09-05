import { useEffect, useRef } from "react";
import { useAuth, useClerk, useUser } from "@clerk/react";
import { useLocation } from "wouter";
import {
  getGetAccessStatusQueryKey,
  useCreateBillingPortal,
  useCreateSubscriptionCheckout,
  useGetAccessStatus,
} from "@workspace/api-client-react";

const PENDING_CHECKOUT = "nano_pending_checkout";

export function PendingCheckout() {
  const { isLoaded, isSignedIn } = useAuth();
  const started = useRef(false);
  const checkout = useCreateSubscriptionCheckout();

  useEffect(() => {
    if (
      !isLoaded ||
      !isSignedIn ||
      started.current ||
      localStorage.getItem(PENDING_CHECKOUT) !== "1"
    ) {
      return;
    }
    started.current = true;
    localStorage.removeItem(PENDING_CHECKOUT);
    checkout.mutate(undefined, {
      onSuccess: ({ url }) => window.location.assign(url),
      onError: () => {
        started.current = false;
        localStorage.setItem(PENDING_CHECKOUT, "1");
      },
    });
  }, [checkout, isLoaded, isSignedIn]);

  return null;
}

export function AccessControls({ compact = false }: { compact?: boolean }) {
  const [, setLocation] = useLocation();
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const { user } = useUser();
  const status = useGetAccessStatus({
    query: {
      queryKey: getGetAccessStatusQueryKey(),
      enabled: isLoaded,
      refetchInterval: 30_000,
    },
  });
  const checkout = useCreateSubscriptionCheckout();
  const portal = useCreateBillingPortal();

  const beginCheckout = () => {
    if (!isSignedIn) {
      localStorage.setItem(PENDING_CHECKOUT, "1");
      setLocation("/sign-in");
      return;
    }
    checkout.mutate(undefined, {
      onSuccess: ({ url }) => window.location.assign(url),
    });
  };

  const openPortal = () => {
    portal.mutate(undefined, {
      onSuccess: ({ url }) => window.location.assign(url),
    });
  };

  const buttonClass =
    "inline-flex items-center justify-center px-3 py-1.5 rounded-md text-sm font-medium border border-border hover:bg-secondary transition-colors disabled:opacity-50";

  return (
    <div className="flex items-center gap-2">
      {isSignedIn ? (
        <button
          type="button"
          className={buttonClass}
          onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}
          title="Signed in with Google — click to sign out"
          data-testid="button-google-account"
        >
          {compact ? "Google ✓" : `Google: ${user?.firstName ?? "Signed in"}`}
        </button>
      ) : (
        <button
          type="button"
          className={buttonClass}
          onClick={() => setLocation("/sign-in")}
          data-testid="button-google-login"
        >
          Continue with Google
        </button>
      )}
      <button
        type="button"
        className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`}
        onClick={status.data?.paid ? openPortal : beginCheckout}
        disabled={checkout.isPending || portal.isPending}
        data-testid="button-subscribe"
        title="Recurring monthly subscription"
      >
        {status.data?.paid
          ? "Manage subscription"
          : compact
            ? "Unlimited · monthly"
            : "Unlock unlimited app use · recurring monthly"}
      </button>
    </div>
  );
}