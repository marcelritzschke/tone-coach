"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";

const Icon: React.FC<{theme: string}> = ({theme}) => {
  switch(theme) {
    case "light":
      return <i className="bi bi-brightness-high"></i>;
    case "dark":
      return <i className="bi bi-moon-stars-fill"></i>;
    default:
      return <i className="bi bi-circle-half"></i>;
  }
}

const ThemeChanger: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  let resolvedTheme: string;
  switch (theme) {
    case "light":
      resolvedTheme = "light";
      break;
    case "dark":
      resolvedTheme = "dark";
      break;
    default:
      resolvedTheme = "system";
      break;
  }

  if (!mounted) {
    //TODO: avoid flickering
    return <i className="bi bi-circle-half me-2"></i>;
  }

  return (
    <div className="dropdown">
      <Link href="#" className="dropdown-toggle nav-link" data-bs-toggle="dropdown">
        <Icon theme={resolvedTheme} />
      </Link>
      <ul className="dropdown-menu dropdown-menu-end">
        <li>
          <a
            href=""
            className={`dropdown-item ${
              resolvedTheme == "light" ? "active" : ""
            }`}
            onClick={() => setTheme("light")}
          >
            <i className="bi bi-brightness-high me-2"></i>
            <span className="me-3">Light</span>
            {resolvedTheme == "light" && <i className="bi bi-check2"></i>}
          </a>
        </li>
        <li>
          <a
            href=""
            className={`dropdown-item ${
              resolvedTheme == "dark" ? "active" : ""
            }`}
            onClick={() => setTheme("dark")}
          >
            <i className="bi bi-moon-stars-fill me-2"></i>
            <span className="me-3">Dark</span>
            {resolvedTheme == "dark" && <i className="bi bi-check2"></i>}
          </a>
        </li>
        <li>
          <a
            href=""
            className={`dropdown-item ${
              resolvedTheme == "system" ? "active" : ""
            }`}
            onClick={() => setTheme("system")}
          >
            <i className="bi bi-circle-half me-2"></i>
            <span className="me-3">System</span>
            {resolvedTheme == "system" && <i className="bi bi-check2"></i>}
          </a>
        </li>
      </ul>
    </div>
  );
};

export default ThemeChanger;