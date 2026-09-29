import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <svg fill="none" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g id="tile">
        <rect x="16" y="16" width="480" height="480" rx="112" fill="#18181b" />
      </g>
      <g id="mark" stroke="#fafafa" strokeLinecap="round">
        <circle id="bowl" cx="210" cy="272" r="94" strokeWidth={64} />
        <path id="stem" d="M332 394 L332 168" strokeWidth={64} />
        <g id="branches" strokeWidth={52}>
          <path d="M332 168 L270 100" />
          <path d="M332 168 L396 102" />
        </g>
      </g>
    </svg>,
    size,
  );
}
