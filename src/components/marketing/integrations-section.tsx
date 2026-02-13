"use client";

const integrations = [
  {
    name: "Slack",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>
    ),
    color: "#E01E5A",
    category: "Communication",
  },
  {
    name: "Gmail",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
      </svg>
    ),
    color: "#EA4335",
    category: "Communication",
  },
  {
    name: "Google Calendar",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M18.316 5.684H24v12.632h-5.684V5.684zM5.684 24h12.632v-5.684H5.684V24zM18.316 5.684V0H1.895A1.894 1.894 0 0 0 0 1.895v16.421h5.684V5.684h12.632zm-7.716 6.789l-.985 3.586-1.006-3.586H7.467v4.972h.888v-3.586l.971 3.586h.893l.97-3.586v3.586h.89v-4.972h-1.5zm4.755 2.588c0-.289-.056-.51-.166-.665-.111-.155-.289-.232-.534-.232-.197 0-.364.054-.502.16a.892.892 0 0 0-.277.398v2.723h-.862v-4.972h.862v1.849c.116-.168.268-.3.454-.396.187-.096.397-.144.631-.144.379 0 .671.12.876.36.206.24.309.582.309 1.025v2.278h-.861v-2.384h.07z"/>
      </svg>
    ),
    color: "#4285F4",
    category: "Productivity",
  },
  {
    name: "Notion",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.45.327s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.14c-.093-.514.28-.886.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.933.653.933 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.448-1.632z"/>
      </svg>
    ),
    color: "#000000",
    category: "Productivity",
  },
  {
    name: "GitHub",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
      </svg>
    ),
    color: "#181717",
    category: "Development",
  },
  {
    name: "Linear",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M3.357 3.357a1.5 1.5 0 0 1 2.121 0l15.165 15.165a1.5 1.5 0 0 1-2.121 2.121L3.357 5.478a1.5 1.5 0 0 1 0-2.121zM.75 12a11.25 11.25 0 0 1 3.278-7.972L18.972 18.972A11.25 11.25 0 0 1 .75 12z"/>
      </svg>
    ),
    color: "#5E6AD2",
    category: "Development",
  },
  {
    name: "Salesforce",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M10.006 5.415a4.195 4.195 0 0 1 3.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.16 5.22c-.45 0-.884-.06-1.305-.165a3.84 3.84 0 0 1-3.36 1.995c-.63 0-1.245-.15-1.785-.42a4.95 4.95 0 0 1-4.29 2.49c-2.235 0-4.14-1.485-4.755-3.54a3.66 3.66 0 0 1-.54.045c-2.025 0-3.66-1.665-3.66-3.72 0-1.47.855-2.745 2.1-3.33a4.4 4.4 0 0 1-.225-1.395c0-2.46 1.98-4.455 4.425-4.455 1.38 0 2.61.63 3.435 1.62l.126-.015z"/>
      </svg>
    ),
    color: "#00A1E0",
    category: "CRM",
  },
  {
    name: "HubSpot",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M18.164 7.93V5.084a2.198 2.198 0 0 0 1.267-1.984v-.066A2.2 2.2 0 0 0 17.231.836h-.066a2.2 2.2 0 0 0-2.2 2.198v.066c0 .864.501 1.61 1.227 1.967v2.862a5.52 5.52 0 0 0-3.615 2.36l-6.032-4.692a2.61 2.61 0 0 0 .063-.558 2.61 2.61 0 1 0-2.61 2.61c.431 0 .835-.11 1.19-.298l5.897 4.59a5.53 5.53 0 0 0-.224 1.552c0 .573.089 1.126.248 1.647l-2.022 1.02a2.125 2.125 0 0 0-1.478-.608 2.13 2.13 0 1 0 2.13 2.13c0-.145-.016-.287-.043-.425l2.089-1.055a5.542 5.542 0 0 0 9.175-4.181c0-2.626-1.837-4.82-4.287-5.387zM17.198 17.45a2.543 2.543 0 0 1-2.538-2.543 2.543 2.543 0 1 1 2.538 2.543z"/>
      </svg>
    ),
    color: "#FF7A59",
    category: "CRM",
  },
  {
    name: "Zoom",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M24 12c0 6.627-5.373 12-12 12S0 18.627 0 12 5.373 0 12 0s12 5.373 12 12zm-6.857-3.143h-2.214c-.386 0-.7.314-.7.7v4.886c0 .386.314.7.7.7h2.214c.386 0 .7-.314.7-.7V9.557c0-.386-.314-.7-.7-.7zm-6.8 0H6.857c-.386 0-.7.314-.7.7v4.886c0 .386.314.7.7.7h3.486c.386 0 .7-.314.7-.7V9.557c0-.386-.314-.7-.7-.7z"/>
      </svg>
    ),
    color: "#2D8CFF",
    category: "Communication",
  },
  {
    name: "Jira",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z"/>
      </svg>
    ),
    color: "#0052CC",
    category: "Development",
  },
  {
    name: "Asana",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M18.78 12.653c-2.882 0-5.22 2.336-5.22 5.218s2.338 5.22 5.22 5.22 5.22-2.338 5.22-5.22-2.338-5.218-5.22-5.218zM5.22 12.653C2.338 12.653 0 14.989 0 17.871s2.338 5.22 5.22 5.22 5.22-2.338 5.22-5.22-2.338-5.218-5.22-5.218zM17.22 5.218c0 2.882-2.338 5.22-5.22 5.22S6.78 8.1 6.78 5.218 9.118 0 12 0s5.22 2.336 5.22 5.218z"/>
      </svg>
    ),
    color: "#F06A6A",
    category: "Productivity",
  },
  {
    name: "Google Drive",
    icon: (
      <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
        <path d="M7.71 0l7.99 14.42H24L16.03 0H7.71zm7.89 15.67L12 22.36l-3.58-6.69h15.1L20 22.32H3.55L0 15.67h15.6zM7.71 0L0 14.42h7.99L15.7 0H7.71z"/>
      </svg>
    ),
    color: "#4285F4",
    category: "Productivity",
  },
];

const categories = ["All", "Communication", "Productivity", "Development", "CRM"];

export function IntegrationsSection() {
  return (
    <section id="integrations" className="mx-auto max-w-[1160px] px-12 py-[100px] max-[960px]:px-6">
      <div className="mb-[14px] text-center text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
        Integrations
      </div>
      <h2 className="mb-5 text-center text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px] text-aura-text-white">
        Connects to your
        <br />
        <span className="gradient-text">entire stack.</span>
      </h2>
      <p className="mx-auto mb-12 max-w-[520px] text-center text-[16.5px] leading-[1.75] text-aura-text-light">
        Aura plugs into where you already work. No migration, no learning curve — 
        just instant intelligence across all your tools.
      </p>

      {/* Integrations grid */}
      <div className="grid grid-cols-6 gap-4 max-[960px]:grid-cols-4 max-[600px]:grid-cols-3">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className="group flex flex-col items-center justify-center rounded-2xl border border-aura-border bg-aura-surface p-6 transition-all duration-300 hover:border-aura-border-hover card-hover"
          >
            <div
              className="mb-3 text-aura-text-dim transition-colors duration-300 group-hover:text-aura-text-white"
              style={{ color: "currentColor" }}
            >
              {integration.icon}
            </div>
            <span className="text-xs font-medium text-aura-text-dim group-hover:text-aura-text-light transition-colors">
              {integration.name}
            </span>
          </div>
        ))}
      </div>

      {/* Coming soon */}
      <div className="mt-8 text-center">
        <p className="text-sm text-aura-text-dim">
          <span className="text-aura-accent">+ 50 more</span> integrations coming soon
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {["Intercom", "Zendesk", "Monday", "Airtable", "Figma", "Stripe"].map((name) => (
            <span
              key={name}
              className="rounded-full border border-aura-border bg-aura-surface/50 px-3 py-1 text-xs text-aura-text-ghost"
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* Request integration CTA */}
      <div className="mt-10 flex justify-center">
        <a
          href="#"
          className="inline-flex items-center gap-2 rounded-lg border border-aura-border bg-aura-surface px-5 py-2.5 text-sm font-medium text-aura-text-light transition-all hover:border-aura-border-hover hover:text-aura-text-white"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Request an integration
        </a>
      </div>
    </section>
  );
}
