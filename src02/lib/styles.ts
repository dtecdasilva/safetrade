import React from "react";

/* Inline-style equivalents of the Zola form and card styles in globals.css. */

export const inp: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "10px 12px",
  background: "#FFFFFF",
  border: "1px solid #D9E2EC",
  borderRadius: 10,
  color: "#102A43",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.15s",
};

export const btn: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "0 18px",
  background: "#087F5B",
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: "inherit",
  transition: "background-color 0.15s",
};

export const card: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #D9E2EC",
  borderRadius: 14,
  padding: "2rem",
  width: "100%",
  maxWidth: 420,
};
