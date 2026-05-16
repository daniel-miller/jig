import { Link } from "react-router-dom";
import { Hash, Image, UserCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const tools = [
  {
    to: "/favicon",
    title: "Favicon generator",
    description:
      "Turn a Font Awesome icon into a full favicon set — backgrounds, gradients, colors, all sizes.",
    icon: Image,
  },
  {
    to: "/gravatar",
    title: "Gravatar URL",
    description:
      "Build Gravatar URLs from an email. Size, default image, rating, force-default.",
    icon: UserCircle2,
  },
  {
    to: "/hash",
    title: "Hash & random",
    description:
      "SHA-1, SHA-256, SHA-512 via Web Crypto. Random passwords, hex, UUIDs, salts.",
    icon: Hash,
  },
];

export function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Jig</h1>
        <p className="text-muted-foreground mt-1">
          Small browser-side dev utilities. Pick a tool.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map(({ to, title, description, icon: Icon }) => (
          <Link key={to} to={to} className="block">
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <CardTitle>{title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
