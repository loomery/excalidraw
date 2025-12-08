import React, { useRef, useEffect, useState } from "react";
import { rgbToHex } from "@excalidraw/common";

import "./CircularColorPicker.scss";

interface CircularColorPickerProps {
  color: string | null;
  onChange: (color: string) => void;
}

const hslToRgb = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4)),
  ];
};

export const CircularColorPicker = ({
  color,
  onChange,
}: CircularColorPickerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hexValue, setHexValue] = useState(color || "#000000");

  useEffect(() => {
    setHexValue(color || "#000000");
  }, [color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 5; // Padding

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
          const angle = Math.atan2(dy, dx);
          const hue = (angle * 180) / Math.PI + 180;
          const saturation = (dist / radius) * 100;
          ctx.fillStyle = `hsl(${hue}, ${saturation}%, 50%)`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, []);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const clientX =
      "touches" in e
        ? (e as React.TouchEvent).touches[0].clientX
        : (e as React.MouseEvent).clientX;
    const clientY =
      "touches" in e
        ? (e as React.TouchEvent).touches[0].clientY
        : (e as React.MouseEvent).clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const angle = Math.atan2(dy, dx);
    const hue = (angle * 180) / Math.PI + 180;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = Math.min(centerX, centerY) - 5;

    // Clamp distance to radius
    const clampedDist = Math.min(dist, radius);
    const saturation = (clampedDist / radius) * 100;

    const [r, g, b] = hslToRgb(hue, saturation, 50);
    const hex = rgbToHex(r, g, b);
    onChange(hex);
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHexValue(val);
    if (/^#[0-9A-F]{6}$/i.test(val)) {
      onChange(val);
    }
  };

  return (
    <div className="circular-color-picker-container">
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        onMouseDown={(e) => {
          setIsDragging(true);
          handleInteraction(e);
        }}
        onMouseMove={(e) => {
          if (isDragging) {
            handleInteraction(e);
          }
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={(e) => {
          setIsDragging(true);
          handleInteraction(e);
        }}
        onTouchMove={(e) => {
          if (isDragging) {
            handleInteraction(e);
          }
        }}
        onTouchEnd={() => setIsDragging(false)}
        className="circular-color-picker"
        style={{ cursor: "crosshair", borderRadius: "50%" }}
      />
      <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
        <div
          style={{
            width: "20px",
            height: "20px",
            backgroundColor: color || "transparent",
            border: "1px solid #ccc",
            borderRadius: "50%",
            marginRight: "10px",
          }}
        />
        <input
          type="text"
          value={hexValue}
          onChange={handleHexChange}
          style={{
            border: "1px solid #ccc",
            borderRadius: "4px",
            padding: "4px",
            width: "80px",
          }}
        />
      </div>
    </div>
  );
};
