"use client";

/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  /** "system" resolved to what is actually on screen — a toggle needs this. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  /** Flips the theme; pass the click point to grow the new theme from there. */
  toggleTheme: (origin?: { x: number; y: number }) => void
}

const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)"
const THEME_VALUES: Theme[] = ["dark", "light", "system"]

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

function isTheme(value: string | null): value is Theme {
  if (value === null) {
    return false
  }

  return THEME_VALUES.includes(value as Theme)
}

function getSystemTheme(): ResolvedTheme {
  if (window.matchMedia(COLOR_SCHEME_QUERY).matches) {
    return "dark"
  }

  return "light"
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style")
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}"
    )
  )
  document.head.appendChild(style)

  return () => {
    window.getComputedStyle(document.body)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        style.remove()
      })
    })
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function applyThemeClasses(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolvedTheme)
}

/** Apply theme classes; colour cross-fade uses CSS `--theme-fade` on elements. */
function transitionTheme(resolvedTheme: ResolvedTheme, disableSnap: boolean) {
  const run = () => applyThemeClasses(resolvedTheme)

  if (disableSnap) {
    const restore = disableTransitionsTemporarily()
    run()
    restore()
    return
  }

  if (prefersReducedMotion()) {
    run()
    return
  }

  // Do not use document.startViewTransition here. Next.js 16 / React 19 use view
  // transitions for navigations; a second root transition is skipped and rejects
  // with AbortError ("Transition was skipped"), which surfaces as a runtime error.
  run()
}

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>
    finished: Promise<void>
  }
}

/*
 * Circular reveal: the browser snapshots the page, the theme flips in one
 * step, and only the snapshot animates (a single GPU layer). This is why it
 * stays smooth, unlike fading the colour of every element on the page.
 * Errors from an overlapping navigation transition ("Transition was
 * skipped") are caught, so the theme still flips instantly in that case.
 */
function revealTheme(next: ResolvedTheme, origin?: { x: number; y: number }) {
  const doc = document as ViewTransitionDoc
  const root = document.documentElement
  if (!doc.startViewTransition || prefersReducedMotion()) {
    applyThemeClasses(next)
    return
  }
  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? 0
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  root.dataset.themeTransition = "view"
  try {
    const transition = doc.startViewTransition(() => applyThemeClasses(next))
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 620, easing: "cubic-bezier(0.2, 0, 0, 1)", pseudoElement: "::view-transition-new(root)" },
        )
      })
      .catch(() => {})
    transition.finished
      .catch(() => {})
      .finally(() => {
        delete root.dataset.themeTransition
      })
  } catch {
    delete root.dataset.themeTransition
    applyThemeClasses(next)
  }
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const editableParent = target.closest(
    "input, textarea, select, [contenteditable='true']"
  )
  if (editableParent) {
    return true
  }

  return false
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  // Default off: suppressing transitions makes the theme snap between two very
  // different palettes. The colour properties below are transitioned instead,
  // which reads as a cross-fade. (`prefers-reduced-motion` still skips it.)
  disableTransitionOnChange = false,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme)
  // Mirrors the class actually on <html>, so "system" resolves to what the user
  // sees. Kept in state (not read from the DOM at render) to stay SSR-safe.
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>("light")
  const hasHydratedTheme = React.useRef(false)

  React.useEffect(() => {
    document.documentElement.dataset.themeReady = "true"
    setResolvedTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
  }, [])

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme)
      setThemeState(nextTheme)
    },
    [storageKey]
  )

  const applyTheme = React.useCallback(
    (nextTheme: Theme) => {
      const nextResolved =
        nextTheme === "system" ? getSystemTheme() : nextTheme
      setResolvedTheme(nextResolved)
      transitionTheme(nextResolved, disableTransitionOnChange)
    },
    [disableTransitionOnChange]
  )

  React.useEffect(() => {
    if (!hasHydratedTheme.current) {
      hasHydratedTheme.current = true
      const storedTheme = localStorage.getItem(storageKey)
      if (isTheme(storedTheme) && storedTheme !== theme) {
        setThemeState(storedTheme)
      }
      if (theme !== "system" && (!isTheme(storedTheme) || storedTheme !== "system")) {
        return undefined
      }
      const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
      const handleChange = () => {
        applyTheme("system")
      }
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }

    applyTheme(theme)

    if (theme !== "system") {
      return undefined
    }

    const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY)
    const handleChange = () => {
      applyTheme("system")
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme, applyTheme, storageKey])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (isEditableTarget(event.target)) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      const nextTheme: ResolvedTheme = document.documentElement.classList.contains("dark") ? "light" : "dark"
      revealTheme(nextTheme)
      localStorage.setItem(storageKey, nextTheme)
      setThemeState(nextTheme)
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [storageKey])

  React.useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return
      }

      if (event.key !== storageKey) {
        return
      }

      if (isTheme(event.newValue)) {
        setThemeState(event.newValue)
        return
      }

      setThemeState(defaultTheme)
    }

    window.addEventListener("storage", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
    }
  }, [defaultTheme, storageKey])

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      // Toggling from "system" commits to the opposite of what is shown, so a
      // single click always visibly flips the theme.
      toggleTheme: (origin?: { x: number; y: number }) => {
        // Read what is actually on screen: the state can lag on first load
        // when the theme follows the system, which made the first click a no-op.
        const next: ResolvedTheme = document.documentElement.classList.contains("dark") ? "light" : "dark"
        revealTheme(next, origin)
        setTheme(next)
      },
    }),
    [theme, resolvedTheme, setTheme]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
