export type SystemAlert = {
  id: string;
  source: string;
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
};

/** Platform notices. The super-admin console will publish these later. */
export function systemAlerts(): SystemAlert[] {
  return [];
}
