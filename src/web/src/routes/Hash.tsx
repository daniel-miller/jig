import { useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type HashAlgo = "SHA-1" | "SHA-256" | "SHA-512";

async function digest(algo: HashAlgo, input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomPassword(length: number) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  const a = new Uint8Array(length);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => charset[b % charset.length]).join("");
}

function randomHex(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt(bytes: number) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  let s = "";
  for (const b of a) s += String.fromCharCode(b);
  return btoa(s);
}

export function HashPage() {
  const [input, setInput] = useState("Hello, World!");
  const [hashAlgo, setHashAlgo] = useState<HashAlgo | null>(null);
  const [hashValue, setHashValue] = useState("");
  const [hashCopied, setHashCopied] = useState(false);

  const [random, setRandom] = useState("");
  const [randomKind, setRandomKind] = useState("");
  const [randomCopied, setRandomCopied] = useState(false);

  async function runHash(algo: HashAlgo) {
    if (!input) {
      setHashAlgo(algo);
      setHashValue("");
      return;
    }
    const h = await digest(algo, input);
    setHashAlgo(algo);
    setHashValue(h);
  }

  function runRandom(kind: "password" | "hex" | "uuid" | "salt") {
    switch (kind) {
      case "password":
        setRandom(randomPassword(16));
        setRandomKind("Random password (16 chars)");
        break;
      case "hex":
        setRandom(randomHex(32));
        setRandomKind("Random hex (32 bytes)");
        break;
      case "uuid":
        setRandom(crypto.randomUUID());
        setRandomKind("UUID v4");
        break;
      case "salt":
        setRandom(randomSalt(16));
        setRandomKind("Random salt (16 bytes, base64)");
        break;
    }
  }

  async function copy(value: string, target: "hash" | "random") {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    if (target === "hash") {
      setHashCopied(true);
      setTimeout(() => setHashCopied(false), 1500);
    } else {
      setRandomCopied(true);
      setTimeout(() => setRandomCopied(false), 1500);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hash &amp; random
        </h1>
        <p className="text-muted-foreground mt-1">
          Web Crypto for digests and random bytes. Nothing leaves the browser.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hash text</CardTitle>
          <CardDescription>
            SHA-256 and SHA-512 are safe. SHA-1 is legacy — do not use it for
            anything security-critical.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hash-input">Input</Label>
            <Textarea
              id="hash-input"
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter text to hash..."
              className="font-mono"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runHash("SHA-256")}>SHA-256</Button>
            <Button onClick={() => runHash("SHA-512")} variant="secondary">
              SHA-512
            </Button>
            <Button onClick={() => runHash("SHA-1")} variant="outline">
              SHA-1
            </Button>
          </div>

          {hashAlgo && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {hashAlgo} — {hashValue.length} hex chars (
                {hashValue.length / 2} bytes)
              </div>
              <div className="break-all rounded-md border bg-secondary/40 p-3 font-mono text-xs">
                {hashValue || "(empty input)"}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copy(hashValue, "hash")}
                disabled={!hashValue}
              >
                <Copy className="h-3.5 w-3.5" />
                {hashCopied ? "Copied" : "Copy hash"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Random data</CardTitle>
          <CardDescription>
            Cryptographically-secure values from <code>crypto.getRandomValues</code>{" "}
            / <code>crypto.randomUUID</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runRandom("password")}>Password (16)</Button>
            <Button onClick={() => runRandom("hex")} variant="secondary">
              Hex (32 bytes)
            </Button>
            <Button onClick={() => runRandom("uuid")} variant="secondary">
              UUID
            </Button>
            <Button onClick={() => runRandom("salt")} variant="secondary">
              Salt (16 bytes)
            </Button>
          </div>

          {random && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {randomKind} — {random.length} chars
              </div>
              <div className="break-all rounded-md border bg-secondary/40 p-3 font-mono text-xs">
                {random}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copy(random, "random")}
              >
                <Copy className="h-3.5 w-3.5" />
                {randomCopied ? "Copied" : "Copy"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
