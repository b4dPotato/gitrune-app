/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        panel2: "var(--panel2)",
        hov: "var(--hover)",
        act: "var(--active)",
        bd: "var(--bd)",
        bd2: "var(--bd2)",
        tx: "var(--tx)",
        tx2: "var(--tx2)",
        tx3: "var(--tx3)",
        ac: "var(--ac)",
        acbg: "var(--acbg)",
        acbd: "var(--acbd)",
        actx: "var(--actx)",
        ok: "var(--ok)",
        okbg: "var(--okbg)",
        wn: "var(--wn)",
        wnbg: "var(--wnbg)",
        er: "var(--er)",
        erbg: "var(--erbg)",
        inf: "var(--inf)",
        infbg: "var(--infbg)",
        pur: "var(--pur)",
        purbg: "var(--purbg)",
        addbg: "var(--addbg)",
        delbg: "var(--delbg)",
        "on-ac": "var(--on-ac)"
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SF Mono",
          "Cascadia Code",
          "Consolas",
          "Liberation Mono",
          "monospace"
        ]
      },
      borderRadius: { DEFAULT: "5px", md: "6px" }
    }
  },
  plugins: []
};
