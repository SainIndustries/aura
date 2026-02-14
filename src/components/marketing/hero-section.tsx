import { MessageCircle, Phone } from "lucide-react";

const CAL_LINK =
  "https://cal.com/shadman-hossain-k6kwji/15min?overlayCalendar=true";

// Channel icons as SVG components
const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const SlackIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
  </svg>
);

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

const SignalIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.4A9.6 9.6 0 0 1 21.6 12a9.6 9.6 0 0 1-9.6 9.6A9.6 9.6 0 0 1 2.4 12 9.6 9.6 0 0 1 12 2.4zM8.4 7.2v9.6h2.4V12l3.6 4.8h3L12 10.2l5.4-3h-3L12 9.6V7.2z"/>
  </svg>
);

const IMessageIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
    <path d="M12 2C6.477 2 2 5.813 2 10.5c0 2.086.876 3.99 2.326 5.476-.254 1.88-.917 3.583-.94 3.649-.094.26.01.549.235.709.13.092.28.138.43.138.085 0 .17-.014.252-.044.35-.124 3.43-1.288 4.986-2.028A11.25 11.25 0 0 0 12 19c5.523 0 10-3.813 10-8.5S17.523 2 12 2z"/>
  </svg>
);

const channels = [
  { name: "WhatsApp", icon: <WhatsAppIcon />, color: "hover:bg-green-500/10 hover:text-green-500 hover:border-green-500/30" },
  { name: "Slack", icon: <SlackIcon />, color: "hover:bg-purple-500/10 hover:text-purple-500 hover:border-purple-500/30" },
  { name: "Telegram", icon: <TelegramIcon />, color: "hover:bg-blue-400/10 hover:text-blue-400 hover:border-blue-400/30" },
  { name: "Signal", icon: <SignalIcon />, color: "hover:bg-blue-600/10 hover:text-blue-600 hover:border-blue-600/30" },
  { name: "iMessage", icon: <IMessageIcon />, color: "hover:bg-green-400/10 hover:text-green-400 hover:border-green-400/30" },
  { name: "Phone", icon: <Phone className="w-4 h-4" />, color: "hover:bg-aura-accent/10 hover:text-aura-accent hover:border-aura-accent/30" },
];

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pb-[60px] pt-[120px] text-center">
      {/* Orb - adjusts for theme */}
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,143,255,0.07)_0%,rgba(124,92,252,0.03)_35%,transparent_65%)] animate-orb-breathe dark:bg-[radial-gradient(circle,rgba(79,143,255,0.1)_0%,rgba(124,92,252,0.05)_35%,transparent_65%)]" />

      {/* Grid - lighter in light mode */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(rgba(79,143,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(79,143,255,0.03) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 30%, black 10%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 30%, black 10%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-[5] max-w-[780px]">
        <div className="mb-9 inline-flex animate-fade-slide-up items-center gap-2 rounded-full border border-aura-accent/20 bg-aura-accent/10 px-4 py-[5px] pl-[7px] text-[12.5px] font-medium text-aura-accent">
          <span className="h-[7px] w-[7px] rounded-full bg-aura-mint animate-blink" />
          Now in Early Access
        </div>

        <h1 className="mb-7 animate-fade-slide-up text-[clamp(42px,7vw,76px)] font-extrabold leading-[1.05] tracking-[-3px] text-aura-text-white [animation-delay:0.08s] max-[600px]:tracking-[-2px]">
          AI assistants that
          <br />
          <span className="gradient-text">
            never miss a detail
          </span>
        </h1>

        <p className="mx-auto mb-11 max-w-[540px] animate-fade-slide-up text-lg font-normal leading-[1.75] text-aura-text-light [animation-delay:0.16s]">
          Your AI team handles email, calendar, CRM, and communications — 
          working 24/7 across all your tools so you can focus on what matters.
        </p>

        <div className="flex flex-wrap justify-center gap-[14px] animate-fade-slide-up [animation-delay:0.24s]">
          <a
            href="/sign-in"
            className="group inline-flex items-center gap-2 rounded-[10px] bg-aura-accent px-[34px] py-[15px] text-[15px] font-semibold text-white transition-all duration-[250ms] hover:-translate-y-0.5 hover:bg-aura-accent-bright hover:shadow-[0_8px_36px_rgba(79,143,255,0.25)]"
          >
            Start Free Trial
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform duration-200 group-hover:translate-x-[3px]"
            >
              <path
                d="M3 8h10m0 0L9 4m4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a
            href={CAL_LINK}
            className="inline-flex items-center gap-2 rounded-[10px] border border-aura-border bg-transparent px-[34px] py-[15px] text-[15px] font-medium text-aura-text-light transition-all duration-[250ms] hover:border-aura-border-hover hover:bg-aura-surface/50 hover:text-aura-text-white"
          >
            <MessageCircle className="w-4 h-4" />
            Talk to a Human
          </a>
        </div>

        {/* Chat with your AI via section */}
        <div className="mt-12 animate-fade-slide-up [animation-delay:0.32s]">
          <p className="text-sm text-aura-text-dim mb-4">Chat with your AI assistant via:</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {channels.map((channel) => (
              <div
                key={channel.name}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border border-aura-border bg-aura-surface/50 text-sm font-medium text-aura-text-light transition-all cursor-default ${channel.color}`}
              >
                {channel.icon}
                {channel.name}
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 animate-fade-slide-up [animation-delay:0.4s]">
          <div className="flex items-center gap-2 text-xs text-aura-text-dim">
            <svg className="h-4 w-4 text-aura-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>SOC 2 Ready</span>
          </div>
          <div className="h-4 w-px bg-aura-border" />
          <div className="flex items-center gap-2 text-xs text-aura-text-dim">
            <svg className="h-4 w-4 text-aura-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>End-to-End Encrypted</span>
          </div>
          <div className="h-4 w-px bg-aura-border" />
          <div className="flex items-center gap-2 text-xs text-aura-text-dim">
            <svg className="h-4 w-4 text-aura-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span>100% Audit Trail</span>
          </div>
        </div>
      </div>
    </section>
  );
}
