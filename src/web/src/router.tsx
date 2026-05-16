import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { HomePage } from "@/routes/Home";
import { FaviconPage } from "@/routes/Favicon";
import { GravatarPage } from "@/routes/Gravatar";
import { HashPage } from "@/routes/Hash";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/favicon", element: <FaviconPage /> },
      { path: "/gravatar", element: <GravatarPage /> },
      { path: "/hash", element: <HashPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);
