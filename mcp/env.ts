/** The Pages Function environment. Typed structurally so `mcp/` compiles without Workers types. */
export interface Assets {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>
}

export interface Env {
  /** Cloudflare Pages binding that serves the deployment's own static files. */
  ASSETS: Assets
}
