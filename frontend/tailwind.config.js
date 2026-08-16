/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        // Elevación cálida, menos "caja gris" que la de Tailwind. Va acá y no
        // como clase suelta en index.css para que `hover:shadow-lift` exista.
        lift: "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 28px -8px rgba(15, 23, 42, 0.14)",
        "lift-turf": "0 1px 2px rgba(0, 122, 51, 0.06), 0 16px 36px -10px rgba(0, 200, 83, 0.32)",
      },
      backgroundImage: {
        // Malla suave verde/naranja: el reemplazo del blanco plano en las
        // secciones claras. Definida acá para no repetir el radial-gradient.
        "mesh-turf":
          "radial-gradient(at 0% 0%, hsla(145,63%,42%,0.16) 0px, transparent 55%), radial-gradient(at 100% 0%, hsla(25,95%,53%,0.10) 0px, transparent 50%), radial-gradient(at 60% 100%, hsla(145,63%,42%,0.10) 0px, transparent 55%)",
        "mesh-dark":
          "radial-gradient(at 15% 0%, hsla(145,100%,39%,0.22) 0px, transparent 50%), radial-gradient(at 85% 25%, hsla(25,95%,53%,0.14) 0px, transparent 45%), radial-gradient(at 50% 100%, hsla(145,100%,39%,0.12) 0px, transparent 55%)",
        "hero-turf": "linear-gradient(135deg, #00C853 0%, #009624 100%)",
        // Rayas de césped cortado, para fondos que quieren leerse como cancha.
        "pitch-stripes":
          "repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 48px, transparent 48px, transparent 96px)",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        turf: {
          DEFAULT: "#00C853",
          dark: "#009624",
          light: "#69F0AE",
        },
        // Accessible text/icon variant of `turf`. The brand DEFAULT (#00C853) is
        // ~2.2:1 against white/off-white and fails WCAG AA for text/icon use.
        // Use `turf-accessible` for text-turf/icon-turf color anywhere it sits
        // on a light background; keep `turf` for large decorative surfaces
        // (backgrounds, gradients, large filled UI where the 3:1 large-scale
        // threshold or no threshold applies). See design_guidelines.json
        // colors.palette.primary for the documented usage split.
        "turf-accessible": "#007A33",
        // Igual que turf-accessible pero para el naranja: #FF6B00 da 2.57:1
        // sobre blanco/bg-orange-10 y falla AA para texto. Usá este para
        // texto/iconos naranjas sobre fondo claro (4.6:1).
        "orange-accessible": "#B34A00",
        pitch: {
          DEFAULT: "#2E7D32",
          dark: "#1B5E20",
        },
        orange: {
          DEFAULT: "#FF6B00",
          light: "#FF9E40",
        },
      },
      fontFamily: {
        heading: ['"Barlow Condensed"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        // Deriva lenta sobre el video/imagen de fondo: le saca la sensación de
        // foto congelada sin que se note un movimiento explícito.
        "ken-burns": {
          "0%": { transform: "scale(1.05) translate3d(0, 0, 0)" },
          "50%": { transform: "scale(1.14) translate3d(-1.5%, -1%, 0)" },
          "100%": { transform: "scale(1.05) translate3d(0, 0, 0)" },
        },
        // Cinta de logos/textos que corre en loop. El 50% es a propósito: el
        // contenido va duplicado, así el salto no se ve.
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.06)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        "pitch-sweep": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(200%)" },
        },
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "ken-burns": "ken-burns 22s ease-in-out infinite",
        marquee: "marquee 32s linear infinite",
        "marquee-slow": "marquee 55s linear infinite",
        float: "float 5s ease-in-out infinite",
        "glow-pulse": "glow-pulse 4.5s ease-in-out infinite",
        "gradient-x": "gradient-x 8s ease infinite",
        shimmer: "shimmer 2.2s linear infinite",
        "pitch-sweep": "pitch-sweep 2.5s ease-in-out infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
