"use client";

import { Copy, Check, Code2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function WebChatEmbed() {
  const [copied, setCopied] = useState(false);

  const embedCode = `<script src="https://aura.so/embed.js" data-agent-id="YOUR_AGENT_ID"></script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-aura-border bg-aura-void/50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-aura-accent" />
          <span className="text-sm font-medium text-aura-text-light">
            Embed Code
          </span>
        </div>
        <div className="relative">
          <pre className="overflow-x-auto rounded-md bg-aura-deep p-3 text-xs text-aura-text-dim">
            <code>{embedCode}</code>
          </pre>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute right-2 top-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-3 w-3 text-aura-mint" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-aura-text-dim">
        Add this script to your website to enable the chat widget. Replace{" "}
        <code className="rounded bg-aura-elevated px-1 py-0.5">YOUR_AGENT_ID</code>{" "}
        with your agent&apos;s ID.
      </p>
    </div>
  );
}
