import React from 'react';

export const Logo: React.FC = () => (
  <div className="flex items-center gap-2">
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-indigo-600"
    >
      <rect width="40" height="40" rx="8" fill="currentColor" fillOpacity="0.1" />
      <path
        d="M12 28V12H20L28 20V12"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 28H28"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="28" cy="28" r="3" fill="currentColor" />
    </svg>
    <span className="text-2xl font-bold tracking-tight text-slate-900">
      Handwriting<span className="text-indigo-600">AI</span>
    </span>
  </div>
);
