import React from "react";
import "./Button.css";

export default function Button({ children, onClick, disabled, fullWidth, className = "" }) {
  return (
    <button
      className={`button ${fullWidth ? "full-width" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
