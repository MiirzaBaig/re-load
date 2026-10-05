/* Shared by the root layout and the client. No "use client": the root layout
   inlines WELCOME_BOOTSTRAP in <head>, so the welcome covers the very first
   paint instead of flashing the dashboard first. It only acts on /admin. */

export const ADMIN_WELCOME_KEY = "reload-admin-welcome";

export const WELCOME_BOOTSTRAP = `(function(){try{if(location.pathname!=="/admin")return;var d=document.documentElement;if(sessionStorage.getItem("${ADMIN_WELCOME_KEY}")==="1"&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches){d.setAttribute("data-admin-welcome","play");}sessionStorage.removeItem("${ADMIN_WELCOME_KEY}");}catch(e){}})();`;

/** Fired as the welcome curtain lifts (or at once when it is skipped). */
export const WELCOME_DONE_EVENT = "reload:admin-welcome-done";
