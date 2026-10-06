"use client";

import { createContext, useContext } from "react";

// Radix portals default to <body>, outside [data-admin], where the admin theme, font and tokens
// don't apply. The shell provides a node inside [data-admin] to portal into instead.
export const PortalContext = createContext<HTMLElement | null>(null);
export const usePortalContainer = () => useContext(PortalContext) ?? undefined;
