import type { MeResponse } from "../../auth/types";
import { canAccessNavItem, NAV_ITEMS } from "../../../lib/navigation";

type PermissionUser = Pick<MeResponse, "permissions"> | null | undefined;

const reportsNavItem = NAV_ITEMS.find(
  (item) => item.key === "commercial-reports",
);

/** Same gate as the Reportes sidebar item: `read` on `CommercialReport`. */
export function hasCommercialReportPermission(user: PermissionUser): boolean {
  if (!reportsNavItem) return false;
  return canAccessNavItem(user?.permissions, reportsNavItem);
}
