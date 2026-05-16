import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { md5 } from "@/lib/md5";
import { Copy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_IMAGES = [
  { value: "identicon", label: "Identicon — geometric pattern" },
  { value: "monsterid", label: "Monster ID — generated monster" },
  { value: "wavatar", label: "Wavatar — generated face" },
  { value: "retro", label: "Retro — 8-bit pixel face" },
  { value: "robohash", label: "Robohash — generated robot" },
  { value: "blank", label: "Blank — transparent PNG" },
  { value: "mp", label: "Mystery person — gray silhouette" },
];

const RATINGS = [
  { value: "g", label: "G — general audiences" },
  { value: "pg", label: "PG — parental guidance" },
  { value: "r", label: "R — restricted" },
  { value: "x", label: "X — adult" },
];

const SIZES = [40, 80, 120, 200];

function buildUrl(
  email: string,
  size: number,
  def: string,
  rating: string,
  force: boolean,
) {
  const hash = md5(email.trim().toLowerCase());
  const params = new URLSearchParams({
    s: String(size),
    d: def,
    r: rating,
  });
  if (force) params.set("f", "y");
  return `https://www.gravatar.com/avatar/${hash}?${params.toString()}`;
}

export function GravatarPage() {
  const [email, setEmail] = useState("demo@example.com");
  const [size, setSize] = useState(80);
  const [def, setDef] = useState("identicon");
  const [rating, setRating] = useState("g");
  const [force, setForce] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = useMemo(
    () => buildUrl(email, size, def, rating, force),
    [email, size, def, rating, force],
  );

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gravatar URL</h1>
        <p className="text-muted-foreground mt-1">
          MD5 of the normalized email, then the standard query parameters.
          Check out{" "}
          <a
            href="https://jdenticon.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Jdenticon
          </a>{" "}
          for an alternative.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Build URL</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="size">Size</Label>
            <Select
              value={String(size)}
              onValueChange={(v) => setSize(Number(v))}
            >
              <SelectTrigger id="size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}px
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="def">Default image</Label>
            <Select value={def} onValueChange={setDef}>
              <SelectTrigger id="def">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_IMAGES.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rating">Content rating</Label>
            <Select value={rating} onValueChange={setRating}>
              <SelectTrigger id="rating">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RATINGS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 md:mt-7">
            <Checkbox
              id="force"
              checked={force}
              onCheckedChange={(v) => setForce(v === true)}
            />
            <Label htmlFor="force" className="cursor-pointer">
              Force default image
            </Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
          <CardDescription>
            Live preview. URL updates as you change inputs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <img
              src={url}
              alt={`Gravatar for ${email}`}
              width={size}
              height={size}
              className="rounded-md border"
              style={{ width: size, height: size }}
            />
            <div className="flex-1 space-y-2 min-w-0 w-full">
              <div className="break-all rounded-md border bg-secondary/40 p-3 font-mono text-xs">
                {url}
              </div>
              <Button onClick={copy} size="sm" variant="secondary">
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy URL"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default image gallery</CardTitle>
          <CardDescription>
            Same email rendered with each default-image style.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {DEFAULT_IMAGES.filter((o) => o.value !== "blank").map((o) => {
              const sample = buildUrl(email, 96, o.value, "g", true);
              return (
                <div
                  key={o.value}
                  className="flex flex-col items-center gap-2 rounded-md border p-3"
                >
                  <img
                    src={sample}
                    alt={o.value}
                    width={96}
                    height={96}
                    className="rounded-md"
                  />
                  <span className="text-xs font-medium">{o.value}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
