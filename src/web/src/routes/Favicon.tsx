import { useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

type BgStyle = "solid" | "gradient" | "circle" | "rounded" | "transparent";

const PRESETS = [
  "fa-solid fa-home",
  "fa-solid fa-heart",
  "fa-solid fa-star",
  "fa-brands fa-github",
  "fa-solid fa-rocket",
  "fa-solid fa-coffee",
  "fa-solid fa-ice-cream",
];

const SIZES: { size: number; name: string; title: string }[] = [
  { size: 16, name: "favicon-16x16.png", title: "16×16 (browser tab)" },
  { size: 32, name: "favicon-32x32.png", title: "32×32 (browser tab)" },
  { size: 48, name: "favicon-48x48.png", title: "48×48 (Windows)" },
  { size: 180, name: "apple-touch-icon.png", title: "180×180 (iOS)" },
  { size: 192, name: "android-chrome-192x192.png", title: "192×192 (Android)" },
  { size: 512, name: "android-chrome-512x512.png", title: "512×512 (Android)" },
];

function paintBackground(
  ctx: CanvasRenderingContext2D,
  size: number,
  style: BgStyle,
  bg: string,
  bg2: string,
) {
  ctx.clearRect(0, 0, size, size);
  switch (style) {
    case "solid":
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);
      return;
    case "gradient": {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, bg);
      g.addColorStop(1, bg2);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      return;
    }
    case "circle":
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    case "rounded": {
      const r = size * 0.2;
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, r);
      ctx.fill();
      return;
    }
    case "transparent":
      return;
  }
}

function paintIcon(
  ctx: CanvasRenderingContext2D,
  size: number,
  ch: string,
  fontFamily: string,
  fontWeight: string,
  color: string,
  scalePct: number,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${(size * scalePct) / 100}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, size / 2, size / 2);
  ctx.restore();
}

function readIconGlyph(iconClass: string): {
  char: string;
  family: string;
  weight: string;
} | null {
  const probe = document.createElement("i");
  probe.className = iconClass;
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  probe.style.fontSize = "32px";
  document.body.appendChild(probe);
  try {
    const cs = window.getComputedStyle(probe, "::before");
    const raw = cs.getPropertyValue("content");
    if (!raw || raw === "none" || raw === '""') return null;
    const char = raw.replace(/^['"]|['"]$/g, "");
    return {
      char,
      family: cs.getPropertyValue("font-family") || '"Font Awesome 6 Free"',
      weight: cs.getPropertyValue("font-weight") || "900",
    };
  } finally {
    document.body.removeChild(probe);
  }
}

export function FaviconPage() {
  const [iconClass, setIconClass] = useState("fa-solid fa-ice-cream");
  const [style, setStyle] = useState<BgStyle>("rounded");
  const [iconColor, setIconColor] = useState("#FFFFFF");
  const [bgColor, setBgColor] = useState("#667eea");
  const [bgColor2, setBgColor2] = useState("#764ba2");
  const [scale, setScale] = useState(70);
  const [error, setError] = useState<string | null>(null);
  const [glyphTick, setGlyphTick] = useState(0);

  // Re-resolve glyph when icon class changes
  useEffect(() => {
    // Font Awesome stylesheet loads async; give it a beat then re-evaluate
    const id = window.setTimeout(() => setGlyphTick((n) => n + 1), 80);
    return () => window.clearTimeout(id);
  }, [iconClass]);

  const glyph = useMemo(() => {
    const g = readIconGlyph(iconClass);
    if (!g) {
      setError(`Icon "${iconClass}" not found in Font Awesome 6.5.0.`);
      return null;
    }
    setError(null);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iconClass, glyphTick]);

  const previewRef = useRef<HTMLCanvasElement>(null);

  // Paint previews when any input changes
  useEffect(() => {
    if (!glyph) return;
    // big preview
    if (previewRef.current) {
      const ctx = previewRef.current.getContext("2d")!;
      const s = previewRef.current.width;
      paintBackground(ctx, s, style, bgColor, bgColor2);
      paintIcon(ctx, s, glyph.char, glyph.family, glyph.weight, iconColor, scale);
    }
    // tiles
    for (const { size, name } of SIZES) {
      const el = document.querySelector<HTMLCanvasElement>(
        `canvas[data-favicon="${name}"]`,
      );
      if (!el) continue;
      const ctx = el.getContext("2d")!;
      paintBackground(ctx, size, style, bgColor, bgColor2);
      paintIcon(ctx, size, glyph.char, glyph.family, glyph.weight, iconColor, scale);
    }
  }, [glyph, style, bgColor, bgColor2, iconColor, scale]);

  function download(name: string) {
    const el = document.querySelector<HTMLCanvasElement>(
      `canvas[data-favicon="${name}"]`,
    );
    if (!el) return;
    const a = document.createElement("a");
    a.download = name;
    a.href = el.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Favicon generator
        </h1>
        <p className="text-muted-foreground mt-1">
          Pick a Font Awesome icon, style the background, download the PNG set.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configure</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="icon">Font Awesome icon</Label>
            <Input
              id="icon"
              value={iconClass}
              onChange={(e) => setIconClass(e.target.value)}
              placeholder="fa-solid fa-home"
              className="font-mono"
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setIconClass(p)}
                  className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:bg-accent"
                >
                  {p}
                </button>
              ))}
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="style">Background style</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as BgStyle)}>
              <SelectTrigger id="style">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid color</SelectItem>
                <SelectItem value="gradient">Gradient</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
                <SelectItem value="rounded">Rounded square</SelectItem>
                <SelectItem value="transparent">Transparent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Icon size ({scale}%)</Label>
            <Slider
              min={40}
              max={100}
              step={1}
              value={[scale]}
              onValueChange={(v) => setScale(v[0])}
            />
          </div>

          <ColorField
            label="Icon color"
            value={iconColor}
            onChange={setIconColor}
          />
          <ColorField
            label="Background color"
            value={bgColor}
            onChange={setBgColor}
          />
          {style === "gradient" && (
            <ColorField
              label="Gradient end color"
              value={bgColor2}
              onChange={setBgColor2}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Large render at 256×256.</CardDescription>
        </CardHeader>
        <CardContent>
          <canvas
            ref={previewRef}
            width={256}
            height={256}
            className="rounded-md border"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Download set</CardTitle>
          <CardDescription>
            PNG output at each standard favicon size.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {SIZES.map(({ size, name, title }) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2 rounded-md border p-3"
              >
                <canvas
                  data-favicon={name}
                  width={size}
                  height={size}
                  className="border"
                  style={{
                    width: Math.min(size, 80),
                    height: Math.min(size, 80),
                    imageRendering: size <= 48 ? "pixelated" : "auto",
                  }}
                />
                <span className="text-xs text-center text-muted-foreground">
                  {title}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => download(name)}
                  className="w-full"
                >
                  <Download className="h-3.5 w-3.5" />
                  PNG
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HTML snippet</CardTitle>
          <CardDescription>Drop into your &lt;head&gt;.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-secondary p-4 text-xs leading-relaxed text-secondary-foreground">
{`<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png">
<link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png">`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background"
        />
        <Input
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) onChange(v);
          }}
          maxLength={7}
          className="font-mono uppercase"
        />
      </div>
    </div>
  );
}
