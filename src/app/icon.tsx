import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #4F46E5 0%, #1E3A8A 45%, #10B981 100%)",
          borderRadius: 7,
        }}
      >
        <svg
          width="25"
          height="25"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Estrutura principal do A */}
          <path
            d="M6.5 23.5L14.1 7.7C14.8 6.2 17 6.2 17.7 7.7L22.1 16.8"
            stroke="white"
            strokeWidth="3.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Linha de automação/crescimento */}
          <path
            d="M8.3 20.4C11.5 15.5 17.6 20.2 24.6 13.3"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Ponta da seta */}
          <path
            d="M21.6 13.5L25.3 12.5L24.5 16.1"
            stroke="white"
            strokeWidth="2.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Balão de conversa */}
          <path
            d="M8.2 20.3C7.8 23.9 10.2 26.1 13.8 26.1H18.5L21.2 28V24.9"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Pontos da conversa */}
          <circle cx="12.4" cy="22.4" r="1" fill="white" />
          <circle cx="15.6" cy="22.4" r="1" fill="white" />
          <circle cx="18.8" cy="22.4" r="1" fill="white" />
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}