import { useEffect } from "react";
import Purchases from "react-native-purchases";

const revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const premiumEntitlementId =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ?? "premium";

let configuredUserId: string | null = null;
let isConfigured = false;

async function ensureRevenueCatUser(userId: string) {
  if (!revenueCatApiKey) {
    throw new Error("Missing EXPO_PUBLIC_REVENUECAT_IOS_API_KEY");
  }
  if (!isConfigured) {
    Purchases.configure({ apiKey: revenueCatApiKey, appUserID: userId });
    configuredUserId = userId;
    isConfigured = true;
    return;
  }
  if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
    configuredUserId = userId;
  }
}

async function logOutRevenueCat() {
  if (!isConfigured) {
    configuredUserId = null;
    return;
  }
  try {
    await Purchases.logOut();
  } finally {
    configuredUserId = null;
  }
}

export function useRevenueCatIdentity(userId: string | undefined) {
  useEffect(() => {
    async function syncIdentity() {
      if (!userId) {
        await logOutRevenueCat();
        return;
      }

      try {
        await ensureRevenueCatUser(userId);
      } catch (error) {
        console.warn("[revenuecat] Failed to sync identity", error);
      }
    }

    void syncIdentity();
  }, [userId]);
}

export async function startRevenueCatPurchase(userId: string) {
  await ensureRevenueCatUser(userId);

  const offerings = await Purchases.getOfferings();
  const packageToBuy = offerings.current?.availablePackages[0];
  if (!packageToBuy) {
    throw new Error("Premium is not configured in RevenueCat yet");
  }

  const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
  const entitlement = customerInfo.entitlements.active[premiumEntitlementId];
  if (!entitlement) {
    throw new Error("Premium purchase completed, but the entitlement is not active yet");
  }
}
